import { LANGUAGE_IDS, marksAgreement, profileOf } from './languages'
import { outputOf, preorder } from './editor'
import { segmentWord, type FeatureAxis, type Paradigms } from './morphology'
import type {
  ApplyNode, CategoryId, LanguageId, LinearizationProjection, LinearizedSegment, Node, NodeId,
} from './model'

type RawToken = { token: string }
export type RawBracket = RawToken | {
  cat: string
  fid: number
  index: number
  fun: string
  /** Exact editor node, when the runtime knows it (the browser runtime's tag paths). */
  node?: NodeId
  children?: RawBracket[]
}
export type RawLinearization = { to: string; text: string; brackets: RawBracket[] }

const isToken = (value: RawBracket): value is RawToken => 'token' in value

type LeafGroup = { fun: string; category: string; node?: NodeId; tokens: string[] }

/**
 * Give server brackets (which carry no node ids) their exact tree nodes by
 * descending the tree with them: a bracket's sub-brackets belong to its node's
 * descendants, and among same-named candidates the first unused one is taken
 * (surface order = argument order for coordination: the man and the woman).
 * The browser runtime already supplies exact ids and is left untouched.
 */
function assignNodes(brackets: RawBracket[], root: Node): RawBracket[] {
  const used = new Set<string>()
  const pick = (fun: string, scope: Node[]): Node | undefined => {
    const queue = [...scope]
    while (queue.length) {
      const node = queue.shift()!
      if (node.kind === 'apply' && node.constructor === fun && !used.has(node.id)) return node
      if (node.kind === 'apply') queue.push(...node.children)
    }
  }
  const visit = (bracket: RawBracket, scope: Node[]): RawBracket => {
    if (isToken(bracket) || bracket.node) return bracket
    const node = pick(bracket.fun, scope)
    if (node) used.add(node.id)
    // A discontinuous constituent repeats its bracket: later copies reuse the node.
    const reuse = node ?? scope.map(candidate => preorder(candidate)).flat()
      .find(candidate => candidate.kind === 'apply' && candidate.constructor === bracket.fun)
    const within = reuse?.kind === 'apply' ? reuse.children : scope
    return { ...bracket, node: reuse?.id, children: (bracket.children ?? []).map(child => visit(child, within)) }
  }
  return brackets.map(bracket => visit(bracket, [root]))
}

function bracketLeaves(brackets: RawBracket[]): LeafGroup[] {
  const groups: LeafGroup[] = []
  const visit = (bracket: RawBracket) => {
    if (isToken(bracket)) return
    const direct = (bracket.children ?? []).filter(isToken).map(child => child.token)
    if (direct.length) groups.push({ fun: bracket.fun, category: bracket.cat, node: bracket.node, tokens: direct })
    for (const child of bracket.children ?? []) if (!isToken(child)) visit(child)
  }
  brackets.forEach(visit)
  return groups
}

/** GF's BIND token: the next token attaches to the previous one with no space (French l'·homme, n'·est). */
export const BIND = '&+'

/**
 * Order segments as the surface reads. A surface word may be several bound
 * segments (*l'homme* = `l'` + `homme`): a segment that binds to the next
 * (`binds`) is matched as a prefix of the word, and the rest of the word is
 * matched after it; the attached segment is marked `bound`.
 */
function inSurfaceOrder(segments: LinearizedSegment[], surface: string, binds: Set<string>): LinearizedSegment[] {
  const remaining = [...segments]
  const ordered: LinearizedSegment[] = []
  const key = (text: string) => text.toLocaleLowerCase().replace(/^[“”"'.,!?;:]+|[“”"'.,!?;:]+$/g, '')
  for (const word of surface.split(/\s+/).filter(Boolean)) {
    let rest = word
    let attached = false
    while (rest) {
      const whole = remaining.findIndex(segment => key(segment.text) === key(rest))
      if (whole >= 0) { const [segment] = remaining.splice(whole, 1); if (attached) segment.bound = true; ordered.push(segment); break }
      const prefix = remaining.findIndex(segment => binds.has(segment.id) && rest.toLocaleLowerCase().startsWith(segment.text.toLocaleLowerCase()))
      if (prefix < 0) break
      const [segment] = remaining.splice(prefix, 1)
      if (attached) segment.bound = true
      ordered.push(segment)
      rest = rest.slice(segment.text.length)
      attached = true
    }
  }
  return [...ordered, ...remaining]
}

function descendantIds(node: Node): Set<NodeId> {
  return new Set(preorder(node).map(item => item.id))
}

function buildYields(root: Node, segments: LinearizedSegment[]): Record<NodeId, string[]> {
  const result: Record<NodeId, string[]> = {}
  for (const node of preorder(root)) {
    const descendants = descendantIds(node)
    result[node.id] = segments
      .filter(segment => segment.realizedBy.some(id => descendants.has(id)))
      .map(segment => segment.id)
  }
  return result
}

function findApply(node: Node, constructor: string): ApplyNode[] {
  return preorder(node).filter((item): item is ApplyNode => item.kind === 'apply' && item.constructor === constructor)
}

const isNegationWord = (language: LanguageId, text: string) => new RegExp(profileOf(language).negation, 'i').test(text)
/** Negation that is its own word (nicht, inte, not), as opposed to fused into an auxiliary (doesn't). */
const isBareNegation = (language: LanguageId, text: string) => {
  const fused = profileOf(language).fusedNegation
  return isNegationWord(language, text) && !(fused && new RegExp(fused, 'i').test(text))
}

/** Tense label carried by the finite element, and whether the tense is anterior (perfect). */
export const TENSES: Record<string, { label: string; perfect: boolean }> = {
  Present: { label: 'PRES', perfect: false }, Past: { label: 'PAST', perfect: false },
  Future: { label: 'FUT', perfect: false }, Conditional: { label: 'COND', perfect: false },
  PresentPerfect: { label: 'PRES', perfect: true }, PastPerfect: { label: 'PAST', perfect: true },
  FuturePerfect: { label: 'FUT', perfect: true }, ConditionalPerfect: { label: 'COND', perfect: true },
}

function link(segment: LinearizedSegment, node: Node, feature: string) {
  if (!segment.realizedBy.includes(node.id)) segment.realizedBy.push(node.id)
  if (!segment.categories.includes(outputOf(node))) segment.categories.push(outputOf(node))
  if (!segment.featureValues.includes(feature)) segment.featureValues.push(feature)
}

/** Per-word controllers: which node each feature axis of a word answers to. */
type Controllers = Map<string, Partial<Record<FeatureAxis, NodeId>>>
const control = (controllers: Controllers, segment: LinearizedSegment, axis: FeatureAxis, node: NodeId | undefined) => {
  if (node) controllers.set(segment.id, { ...controllers.get(segment.id), [axis]: node })
}

/**
 * A clause: one MkS with its tense, polarity, body (PredVP or ExistNP), and
 * the words GF attributed inside it. A coordinated sentence (ConjS) has one
 * clause per conjunct, each with its own tense, polarity, and subject.
 */
type Clause = { sentence: ApplyNode; temp?: ApplyNode; pol?: ApplyNode; body: Node; segments: LinearizedSegment[] }

function clausesOf(root: Node, segments: LinearizedSegment[]): Clause[] {
  return findApply(root, 'MkS').map(sentence => {
    const scope = new Set(preorder(sentence).map(node => node.id))
    const [temp, pol, body] = sentence.children
    return {
      sentence, body,
      temp: temp?.kind === 'apply' ? temp : undefined,
      pol: pol?.kind === 'apply' ? pol : undefined,
      segments: segments.filter(segment => scope.has(segment.realizedBy[0])),
    }
  })
}

/**
 * Subject agreement from the subject's structure: he/she, or any determined
 * noun (every determiner here is singular), is third singular, controlled by
 * the pronoun or head noun; a coordinated subject is plural.
 */
function subjectAgreement(subject: Node | undefined): { label: '3SG'; controller: NodeId } | undefined {
  if (!subject || subject.kind !== 'apply') return undefined
  if (subject.constructor === 'UsePron') {
    const pronoun = subject.children[0]
    return pronoun.kind === 'apply' && (pronoun.constructor === 'HePron' || pronoun.constructor === 'ShePron')
      ? { label: '3SG', controller: pronoun.id } : undefined
  }
  if (subject.constructor === 'DetCN') {
    const noun = preorder(subject.children[1]).find(node => node.kind === 'apply' && node.output === 'N')
    return noun ? { label: '3SG', controller: noun.id } : undefined
  }
  return undefined
}

/**
 * GF attributes auxiliaries (has, wird, ska, didn't, the existential's is/gibt/
 * finns) to structural nodes, never to the Temp node, so tense and agreement are
 * recovered per clause: the finite element is the clause's first auxiliary, or
 * its lexical verb when there is none.
 */
function annotateClause(language: LanguageId, clause: Clause, structural: Set<string>, controllers: Controllers) {
  const profile = profileOf(language)
  const tense = clause.temp ? TENSES[clause.temp.constructor] : undefined
  const verb = clause.body.kind === 'apply' && clause.body.constructor === 'PredVP'
    ? preorder(clause.body.children[1]).find(node => node.kind === 'apply' && (node.output === 'V' || node.output === 'V2'))
    : undefined
  const verbSegment = verb && clause.segments.find(item => item.realizedBy.includes(verb.id))
  const auxiliaries = clause.segments.filter(segment => segment.role === 'overt' && structural.has(segment.realizedBy[0])
    && !isBareNegation(language, segment.text) && !new RegExp(`^(${profile.expletive})$`, 'i').test(segment.text))
  const finite = auxiliaries[0] ?? verbSegment
  if (!finite) return

  for (const segment of clause.segments) {
    control(controllers, segment, 'tense', clause.temp?.id)
    control(controllers, segment, 'aspect', clause.temp?.id)
    if (clause.pol?.constructor === 'Negative') control(controllers, segment, 'polarity', clause.pol.id)
  }
  if (tense && clause.temp) {
    link(finite, clause.temp, tense.label)
    if (tense.perfect) {
      // The participle is the lexical verb, or (copula, existential) the last auxiliary: been, gewesen, funnits.
      // PERF goes to the have/sein auxiliary just before it: has slept, will have slept, haven't been.
      const participle = verbSegment ?? (auxiliaries.length > 1 ? auxiliaries.at(-1) : undefined)
      link(auxiliaries.filter(segment => segment !== participle).at(-1) ?? finite, clause.temp, 'PERF')
      if (participle) link(participle, clause.temp, 'PTCP')
    }
  } else {
    finite.featureValues.push('PRES')
  }

  const agreement = clause.body.kind === 'apply' && clause.body.constructor === 'PredVP' ? subjectAgreement(clause.body.children[0]) : undefined
  // A zero-agreement language (Swedish) still records 3SG; morphology renders it as ∅.
  if (agreement && marksAgreement(profile, tense?.label)) {
    finite.featureValues.push(agreement.label)
    control(controllers, finite, 'agreement', agreement.controller)
  }
}

/**
 * Adjective agreement: an adjective whose form differs from its citation
 * (große, stora, glatt) carries an agreement exponent, controlled by the noun
 * it modifies, or by the subject when it is predicative (barnet är glatt).
 */
function annotateAdjectives(language: LanguageId, root: Node, segments: LinearizedSegment[], paradigms: Paradigms, controllers: Controllers) {
  const citationCell = profileOf(language).citation.adjective
  const tables = paradigms.tables[language] ?? {}
  const adjectiveIn = (node: Node) => preorder(node).find((item): item is ApplyNode => item.kind === 'apply' && item.output === 'A')
  const nounIn = (node: Node) => preorder(node).find(item => item.kind === 'apply' && item.output === 'N')
  const mark = (adjective: ApplyNode | undefined, controller: Node | undefined) => {
    const segment = adjective && segments.find(item => item.realizedBy[0] === adjective.id)
    // A comparative agrees only if it differs from the bare comparative (größere, not predicative größer).
    const cell = segment?.featureValues.includes('CMP') ? profileOf(language).citation.comparative : citationCell
    const citation = adjective && tables[adjective.constructor]?.[cell]
    if (!segment || !citation || segment.text === citation) return
    // A variant chosen by the next word (French vieil before a vowel) is allomorphy, not agreement.
    const cells = Object.entries(tables[adjective!.constructor] ?? {}).filter(([, form]) => form === segment.text).map(([name]) => name)
    if (cells.length && cells.every(name => name.startsWith('pre '))) return
    if (!segment.featureValues.includes('AGR')) segment.featureValues.push('AGR')
    control(controllers, segment, 'agreement', controller?.id)
  }
  // Degree: a comparative's adjective carries CMP, controlled by the comparative (ComparA brings *than* too).
  // Synthetic (big·ger, größer, meilleur) marks the adjective; analytic (plus grand) marks the degree word before it.
  for (const comparative of [...findApply(root, 'ComparA'), ...findApply(root, 'UseComparA')]) {
    const adjective = comparative.children[0]
    const segment = segments.find(item => item.realizedBy[0] === adjective.id)
    if (!segment || adjective.kind !== 'apply') continue
    const form = tables[adjective.constructor]?.[profileOf(language).citation.comparative]
    const position = segments.indexOf(segment)
    const marked = form && segment.text.toLocaleLowerCase().startsWith(form.toLocaleLowerCase())
      ? [segment]
      : segments.filter((item, index) => index < position && item.realizedBy[0] === comparative.id)
    for (const word of marked) {
      if (!word.featureValues.includes('CMP')) word.featureValues.push('CMP')
      control(controllers, word, 'degree', comparative.id)
    }
  }
  for (const modified of findApply(root, 'AdjCN')) mark(adjectiveIn(modified.children[0]), nounIn(modified.children[1]))
  for (const predicate of findApply(root, 'PredVP')) {
    const vp = predicate.children[1]
    if (vp.kind === 'apply' && vp.constructor === 'UseAP') mark(adjectiveIn(vp), nounIn(predicate.children[0]) ?? predicate.children[0])
  }
}

/**
 * Participle agreement (French elle est venu·e, je l'ai vu·e): a participle
 * whose form differs from the profile's base participle cell agrees — with
 * the object of a transitive verb (the preceding clitic), else the subject.
 */
function annotateParticiples(language: LanguageId, root: Node, segments: LinearizedSegment[], paradigms: Paradigms, controllers: Controllers) {
  const base = profileOf(language).participleAgreement
  if (!base) return
  const tables = paradigms.tables[language] ?? {}
  for (const predication of findApply(root, 'PredVP')) {
    const verb = preorder(predication.children[1]).find((node): node is ApplyNode => node.kind === 'apply' && (node.output === 'V' || node.output === 'V2'))
    const segment = verb && segments.find(item => item.realizedBy[0] === verb.id && item.featureValues.includes('PTCP'))
    const form = verb && tables[verb.constructor]?.[base]
    if (!segment || !form || segment.text === form) continue
    const object = findApply(predication.children[1], 'ComplV2')[0]?.children[1]
    if (!segment.featureValues.includes('AGR')) segment.featureValues.push('AGR')
    control(controllers, segment, 'agreement', (object ?? predication.children[0]).id)
  }
}

const CASE_IN_CELL = /\b(Nom|Acc|Dat|Gen)\b|NP(Nom|Acc)/
const caseOf = (cell: string) => { const match = cell.match(CASE_IN_CELL); return match ? match[1] ?? match[2] : undefined }

/**
 * Case governed by a preposition (PrepNP) or transitive verb (ComplV2), taken
 * from the probed government table. A word is labelled only where its form
 * marks the case overtly, i.e. differs from the nominative of the same cell
 * (dem ≠ der, ihm ≠ er, him ≠ he, but Haus = Haus). When the determiner
 * emits nothing because the preposition absorbed it (German im, zum, in der),
 * the preposition's last word realizes the determiner too.
 * Returns each labelled word's governor, the controller of its case.
 */
function annotateCase(language: LanguageId, root: Node, segments: LinearizedSegment[], paradigms: Paradigms): Map<string, NodeId> {
  const governors = new Map<string, NodeId>()
  const government = paradigms.government[language] ?? {}
  const tables = paradigms.tables[language] ?? {}
  const nodes = new Map(preorder(root).map(node => [node.id, node]))
  const mark = (segment: LinearizedSegment, label: string, governor: NodeId) => {
    if (!segment.featureValues.includes(label)) segment.featureValues.push(label)
    governors.set(segment.id, governor)
  }
  for (const phrase of preorder(root)) {
    if (phrase.kind !== 'apply' || !['PrepNP', 'ComplV2', 'ExistNP'].includes(phrase.constructor)) continue
    // The existential governs its noun phrase itself (es gibt einen Vogel).
    const [governor, np] = phrase.constructor === 'ExistNP' ? [phrase, phrase.children[0]] : phrase.children
    const governed = governor.kind === 'apply' ? government[governor.constructor] : undefined
    if (!governed || governed === 'Nom' || np.kind !== 'apply') continue
    const label = governed.toUpperCase()

    const det = np.constructor === 'DetCN' ? np.children[0] : undefined
    if (det?.kind === 'apply' && !segments.some(segment => segment.realizedBy.includes(det.id))) {
      const carrier = segments.filter(segment => segment.realizedBy[0] === governor.id).at(-1)
      if (carrier) { link(carrier, det, det.constructor === 'Indefinite' ? 'INDEF' : 'DEF'); mark(carrier, label, governor.id) }
    }

    const inside = new Set(preorder(np).map(node => node.id))
    for (const segment of segments) {
      const leaf = nodes.get(segment.realizedBy[0])
      if (!leaf || !inside.has(leaf.id) || leaf.kind !== 'apply' || leaf.children.length) continue
      const table = tables[leaf.constructor]
      if (!table) continue
      const nominatives = Object.entries(table).filter(([cell]) => caseOf(cell) === 'Nom').map(([, form]) => form)
      const overt = Object.entries(table).some(([cell, form]) => {
        if (form.toLowerCase() !== segment.text.toLowerCase() || cell.includes('Poss') || caseOf(cell) !== governed) return false
        const counterpart = table[cell.replace(CASE_IN_CELL, match => match.startsWith('NP') ? 'NPNom' : 'Nom')]
        return counterpart !== undefined ? counterpart !== form : !nominatives.includes(form)
      })
      if (overt) mark(segment, label, governor.id)
    }
  }
  return governors
}

function annotate(language: LanguageId, root: Node, segments: LinearizedSegment[], paradigms?: Paradigms): LinearizedSegment[] {
  let result = segments.map(segment => ({ ...segment, realizedBy: [...segment.realizedBy], categories: [...segment.categories], featureValues: [...segment.featureValues] }))

  // GF can emit a preposition as part of the article's form (French à la = the Det's dative cell);
  // a word that is the preposition's own form realizes the preposition, not the article.
  for (const phrase of findApply(root, 'PrepNP')) {
    const prep = phrase.children[0]
    if (prep.kind !== 'apply' || result.some(segment => segment.realizedBy.includes(prep.id))) continue
    const own = (profileOf(language).partialLexicon[prep.constructor] ?? '').split('/').map(word => word.trim().toLocaleLowerCase()).filter(Boolean)
    const inside = descendantIds(phrase.children[1])
    const first = result.find(segment => segment.role === 'overt' && inside.has(segment.realizedBy[0]))
    if (first && own.includes(first.text.toLocaleLowerCase())) { first.realizedBy = [prep.id]; first.categories = ['Prep'] }
  }
  for (const det of findApply(root, 'Definite')) {
    const segment = result.find(item => item.realizedBy.includes(det.id))
    if (segment && !segment.featureValues.includes('DEF')) segment.featureValues.push('DEF')
  }
  for (const det of findApply(root, 'Indefinite')) {
    const segment = result.find(item => item.realizedBy.includes(det.id))
    if (segment && !segment.featureValues.includes('INDEF')) segment.featureValues.push('INDEF')
  }
  if (profileOf(language).suffixedDefiniteness) {
    // Suffixed definiteness (kvinna·n): the noun word also realizes the Det node.
    for (const detCn of findApply(root, 'DetCN')) {
      const [det, cn] = detCn.children
      if (det.kind !== 'apply' || det.constructor !== 'Definite' || cn.kind !== 'apply') continue
      const noun = preorder(cn).find(node => node.kind === 'apply' && node.output === 'N')
      const segment = noun && result.find(item => item.realizedBy[0] === noun.id)
      // Also when the determiner has a word of its own: double definiteness (den stora hunden).
      if (segment) link(segment, det, 'DEF')
    }
  }

  const controllers: Controllers = new Map()
  const clauses = clausesOf(root, result)
  // Negation per clause: the words that realize that clause's Pol (nicht, inte, doesn't; both halves of ne … pas).
  for (const clause of clauses) {
    const pol = clause.pol
    if (pol?.constructor !== 'Negative') continue
    const own = clause.segments.filter(item => item.realizedBy.includes(pol.id))
    for (const segment of own.length ? own : clause.segments.filter(item => isNegationWord(language, item.text))) {
      if (!segment.realizedBy.includes(pol.id)) segment.realizedBy.push(pol.id)
      if (!segment.categories.includes('Pol')) segment.categories.unshift('Pol')
      if (!segment.featureValues.includes('NEG')) segment.featureValues.push('NEG')
    }
  }
  if (paradigms) {
    for (const [segmentId, governor] of annotateCase(language, root, result, paradigms)) controllers.set(segmentId, { ...controllers.get(segmentId), case: governor })
  }
  // realizedBy[0] is GF's own bracket attribution; later entries were added by annotation.
  // Auxiliaries come from clause- and verb-phrase-level nodes only: words a phrase inside
  // an argument emits (than/als, plus, que) are not verbs.
  const structural = new Set(preorder(root).filter(node => node.kind === 'apply' && node.children.length && ['S', 'Cl', 'VP'].includes(node.output)).map(node => node.id))
  for (const clause of clauses) annotateClause(language, clause, structural, controllers)
  // A preposition GF fused into the article (French au = à + le) is realized by that word.
  for (const phrase of findApply(root, 'PrepNP')) {
    const prep = phrase.children[0]
    if (result.some(segment => segment.realizedBy.includes(prep.id))) continue
    const inside = descendantIds(phrase.children[1])
    const first = result.find(segment => segment.role === 'overt' && inside.has(segment.realizedBy[0]))
    if (first) { first.realizedBy.push(prep.id); if (!first.categories.includes('Prep')) first.categories.push('Prep') }
  }
  if (paradigms) {
    annotateParticiples(language, root, result, paradigms, controllers)
    annotateAdjectives(language, root, result, paradigms, controllers)
    attachMorphemes(language, root, result, paradigms, controllers)
  }
  return result
}

const LEXICAL_CATEGORIES = new Set(['N', 'V', 'V2', 'Pron', 'Det', 'A'])

/** Split every overt word into morpheme sub-boxes, each linked to the nodes that control it. */
function attachMorphemes(language: LanguageId, root: Node, segments: LinearizedSegment[], paradigms: Paradigms, controllers: Controllers) {
  const determinerOf = new Map<NodeId, NodeId>()
  for (const detCn of findApply(root, 'DetCN')) {
    const noun = preorder(detCn.children[1]).find(node => node.kind === 'apply' && node.output === 'N')
    if (noun) determinerOf.set(noun.id, detCn.children[0].id)
  }
  const nodes = new Map(preorder(root).map(node => [node.id, node]))
  for (const segment of segments) {
    if (segment.role !== 'overt') continue
    const origin = nodes.get(segment.realizedBy[0])
    const lexeme = origin?.kind === 'apply' && !origin.children.length && LEXICAL_CATEGORIES.has(origin.output)
      ? { id: origin.id, constructor: origin.constructor, category: origin.output }
      : undefined
    segment.morphemes = segmentWord({
      language, lexeme, text: segment.text, features: segment.featureValues, realizedBy: segment.realizedBy,
      controllers: { ...controllers.get(segment.id), definiteness: lexeme ? determinerOf.get(lexeme.id) : undefined },
    }, paradigms)
  }
}

function normalizeOne(raw: RawLinearization, root: Node, revision: number, paradigms?: Paradigms): LinearizationProjection {
  const language = raw.to as LanguageId
  const nodesByConstructor = new Map<string, ApplyNode[]>()
  for (const node of preorder(root)) {
    if (node.kind !== 'apply') continue
    const list = nodesByConstructor.get(node.constructor) ?? []
    list.push(node)
    nodesByConstructor.set(node.constructor, list)
  }
  const nodeById = new Map(preorder(root).filter((node): node is ApplyNode => node.kind === 'apply').map(node => [node.id, node]))
  const occurrence = new Map<string, number>()
  let serial = 0
  const base: LinearizedSegment[] = []
  const binds = new Set<string>()
  for (const leaf of bracketLeaves(assignNodes(raw.brackets, root))) {
    // Exact node when the runtime supplies it; otherwise the n-th node with that constructor.
    const index = occurrence.get(leaf.fun) ?? 0
    const candidates = nodesByConstructor.get(leaf.fun) ?? []
    const node = (leaf.node && nodeById.get(leaf.node)) || candidates[Math.min(index, Math.max(0, candidates.length - 1))]
    occurrence.set(leaf.fun, index + 1)
    for (const token of leaf.tokens) {
      if (token === BIND) { const previous = base.at(-1); if (previous) binds.add(previous.id); continue }
      base.push({
        id: `${language}-${serial++}`,
        text: token,
        role: 'overt',
        realizedBy: node ? [node.id] : [],
        categories: node ? [node.output] : [],
        featureValues: [],
      })
    }
  }
  const segments = annotate(language, root, inSurfaceOrder(base, raw.text, binds), paradigms)
  return { language, text: raw.text, segments, nodeYields: buildYields(root, segments), revision, source: 'gf' }
}

export function normalizeLinearizations(raw: RawLinearization[], root: Node, revision: number, paradigms?: Paradigms): LinearizationProjection[] {
  return raw.map(item => normalizeOne(item, root, revision, paradigms))
}

function partialSegments(node: Node, language: LanguageId, serial: { value: number }): LinearizedSegment[] {
  if (node.kind === 'hole') {
    return [{
      id: `${language}-partial-${serial.value++}`, text: `⟦${node.expected}⟧`, role: 'hole',
      realizedBy: [node.id], categories: [node.expected], featureValues: [],
    }]
  }
  if (!node.children.length) {
    const text = profileOf(language).partialLexicon[node.constructor]
    if (!text) return []
    return [{
      id: `${language}-partial-${serial.value++}`, text, role: 'overt',
      realizedBy: [node.id], categories: [node.output], featureValues: [],
    }]
  }
  return node.children.flatMap(child => partialSegments(child, language, serial))
}

export function partialProjections(root: Node, revision: number): LinearizationProjection[] {
  return LANGUAGE_IDS.map(language => {
    const segments = partialSegments(root, language, { value: 0 })
    return {
      language,
      text: segments.map(item => item.text).join(' '),
      nodeYields: buildYields(root, segments), segments, revision, source: 'partial',
    }
  })
}
