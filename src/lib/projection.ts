import { LANGUAGE_IDS, marksAgreement, profileOf } from './languages'
import { outputOf, preorder } from './editor'
import { segmentWord, type Paradigms } from './morphology'
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

function inSurfaceOrder(segments: LinearizedSegment[], surface: string): LinearizedSegment[] {
  const remaining = [...segments]
  const ordered: LinearizedSegment[] = []
  const key = (text: string) => text.toLocaleLowerCase().replace(/^[“”"'.,!?;:]+|[“”"'.,!?;:]+$/g, '')
  for (const word of surface.split(/\s+/).filter(Boolean)) {
    const index = remaining.findIndex(segment => key(segment.text) === key(word))
    if (index >= 0) ordered.push(...remaining.splice(index, 1))
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

const THIRD_SINGULAR = ['HePron', 'ShePron', 'ManN', 'WomanN', 'HouseN', 'DogN', 'CatN', 'BookN']

function link(segment: LinearizedSegment, node: Node, feature: string) {
  if (!segment.realizedBy.includes(node.id)) segment.realizedBy.push(node.id)
  if (!segment.categories.includes(outputOf(node))) segment.categories.push(outputOf(node))
  if (!segment.featureValues.includes(feature)) segment.featureValues.push(feature)
}

/**
 * GF attributes auxiliaries (has, wird, ska, didn't) to structural nodes such as
 * PredVP, never to the Temp node, so tense and agreement are recovered here:
 * the finite element is the first auxiliary, or the lexical verb when there is none.
 */
function annotateVerbGroup(language: LanguageId, root: Node, segments: LinearizedSegment[]) {
  const pred = findApply(root, 'PredVP')[0]
  if (!pred) return
  const [subject, vp] = pred.children
  const verb = preorder(vp).find(node => node.kind === 'apply' && (node.output === 'V' || node.output === 'V2'))
  const verbSegment = verb && segments.find(item => item.realizedBy.includes(verb.id))
  if (!verb || !verbSegment) return

  const temp = findApply(root, 'MkS')[0]?.children[0]
  const tense = temp?.kind === 'apply' ? TENSES[temp.constructor] : undefined
  // realizedBy[0] is GF's own bracket attribution; later entries were added by annotation.
  const structural = new Set(preorder(root).filter(node => node.kind === 'apply' && node.children.length).map(node => node.id))
  const auxiliaries = segments.filter(segment => segment.role === 'overt' && structural.has(segment.realizedBy[0]) &&
    !isBareNegation(language, segment.text))
  const finite = auxiliaries[0] ?? verbSegment

  if (tense && temp) {
    link(finite, temp, tense.label)
    if (tense.perfect) {
      link(auxiliaries.find(segment => segment !== finite) ?? finite, temp, 'PERF')
      link(verbSegment, temp, 'PTCP')
    }
  } else {
    finite.featureValues.push('PRES')
  }

  const subjectHead = preorder(subject).find(node => node.kind === 'apply' && THIRD_SINGULAR.includes(node.constructor))
  if (!subjectHead) return
  // A zero-agreement language (Swedish) still records 3SG; morphology renders it as ∅.
  if (marksAgreement(profileOf(language), tense?.label)) finite.featureValues.push('3SG')
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
    if (phrase.kind !== 'apply' || (phrase.constructor !== 'PrepNP' && phrase.constructor !== 'ComplV2')) continue
    const [governor, np] = phrase.children
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

  for (const det of findApply(root, 'Definite')) {
    const segment = result.find(item => item.realizedBy.includes(det.id))
    if (segment && !segment.featureValues.includes('DEF')) segment.featureValues.push('DEF')
  }
  for (const det of findApply(root, 'Indefinite')) {
    const segment = result.find(item => item.realizedBy.includes(det.id))
    if (segment && !segment.featureValues.includes('INDEF')) segment.featureValues.push('INDEF')
  }
  for (const pol of findApply(root, 'Negative')) {
    const segment = result.find(item => item.realizedBy.includes(pol.id))
      ?? result.find(item => isNegationWord(language, item.text))
    if (segment) {
      if (!segment.realizedBy.includes(pol.id)) segment.realizedBy.push(pol.id)
      if (!segment.categories.includes('Pol')) segment.categories.unshift('Pol')
      if (!segment.featureValues.includes('NEG')) segment.featureValues.push('NEG')
    }
  }

  if (profileOf(language).suffixedDefiniteness) {
    // Suffixed definiteness (kvinna·n): the noun word also realizes the Det node.
    for (const detCn of findApply(root, 'DetCN')) {
      const [det, cn] = detCn.children
      if (det.kind !== 'apply' || det.constructor !== 'Definite' || cn.kind !== 'apply') continue
      const noun = preorder(cn).find(node => node.kind === 'apply' && node.output === 'N')
      const segment = noun && result.find(item => item.realizedBy[0] === noun.id)
      if (segment && !result.some(item => item.realizedBy[0] === det.id)) link(segment, det, 'DEF')
    }
  }

  const governors = paradigms ? annotateCase(language, root, result, paradigms) : new Map<string, NodeId>()
  annotateVerbGroup(language, root, result)
  if (paradigms) attachMorphemes(language, root, result, paradigms, governors)
  return result
}

const LEXICAL_CATEGORIES = new Set(['N', 'V', 'V2', 'Pron', 'Det'])

/** Split every overt word into morpheme sub-boxes, each linked to the nodes that control it. */
function attachMorphemes(language: LanguageId, root: Node, segments: LinearizedSegment[], paradigms: Paradigms, governors: Map<string, NodeId>) {
  const temp = findApply(root, 'MkS')[0]?.children[0]
  const pol = findApply(root, 'Negative')[0]
  const subject = findApply(root, 'PredVP')[0]?.children[0]
  const subjectHead = subject && preorder(subject).find(node => node.kind === 'apply' && THIRD_SINGULAR.includes(node.constructor))
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
      controllers: {
        tense: temp?.id, aspect: temp?.id, agreement: subjectHead?.id, polarity: pol?.id,
        definiteness: lexeme ? determinerOf.get(lexeme.id) : undefined,
        case: governors.get(segment.id),
      },
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
  for (const leaf of bracketLeaves(raw.brackets)) {
    // Exact node when the runtime supplies it; otherwise the n-th node with that constructor.
    const index = occurrence.get(leaf.fun) ?? 0
    const candidates = nodesByConstructor.get(leaf.fun) ?? []
    const node = (leaf.node && nodeById.get(leaf.node)) || candidates[Math.min(index, Math.max(0, candidates.length - 1))]
    occurrence.set(leaf.fun, index + 1)
    for (const token of leaf.tokens) {
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
  const segments = annotate(language, root, inSurfaceOrder(base, raw.text), paradigms)
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
