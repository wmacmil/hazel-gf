import { partialLexicon } from './grammar'
import { outputOf, preorder } from './editor'
import type {
  ApplyNode, CategoryId, LanguageId, LinearizationProjection, LinearizedSegment, Node, NodeId,
} from './model'

type RawToken = { token: string }
export type RawBracket = RawToken | {
  cat: string
  fid: number
  index: number
  fun: string
  children?: RawBracket[]
}
export type RawLinearization = { to: string; text: string; brackets: RawBracket[] }

const LANGUAGES: LanguageId[] = ['HazelGFEng', 'HazelGFGer', 'HazelGFSwe']
const isToken = (value: RawBracket): value is RawToken => 'token' in value

type LeafGroup = { fun: string; category: string; tokens: string[] }

function bracketLeaves(brackets: RawBracket[]): LeafGroup[] {
  const groups: LeafGroup[] = []
  const visit = (bracket: RawBracket) => {
    if (isToken(bracket)) return
    const direct = (bracket.children ?? []).filter(isToken).map(child => child.token)
    if (direct.length) groups.push({ fun: bracket.fun, category: bracket.cat, tokens: direct })
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

const swedishDefinite: Record<string, [string, string]> = {
  ManN: ['man', 'nen'], WomanN: ['kvinna', 'n'], HouseN: ['hus', 'et'],
  DogN: ['hund', 'en'], CatN: ['katt', 'en'], BookN: ['bok', 'en'],
}

const NEGATION: Record<LanguageId, RegExp> = {
  HazelGFEng: /^(not|\w+n't)$/i, HazelGFGer: /^nicht$/i, HazelGFSwe: /^inte$/i,
}
const isNegationWord = (language: LanguageId, text: string) => NEGATION[language].test(text)
const isBareNegation = (language: LanguageId, text: string) =>
  isNegationWord(language, text) && !/\w+n't$/i.test(text)

/** Tense label carried by the finite element, and whether the tense is anterior (perfect). */
const TENSES: Record<string, { label: string; perfect: boolean }> = {
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
  if (language === 'HazelGFSwe') {
    segments.splice(segments.indexOf(finite) + 1, 0, {
      id: `${language}-zero-3sg`, text: '∅', role: 'zero',
      realizedBy: [subjectHead.id, verb.id], categories: [outputOf(verb)],
      featureValues: ['3SG'],
    })
  } else if (language === 'HazelGFGer' || !tense || tense.label === 'PRES') {
    finite.featureValues.push('3SG')
  }
}

function annotate(language: LanguageId, root: Node, segments: LinearizedSegment[]): LinearizedSegment[] {
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

  if (language === 'HazelGFSwe') {
    for (const detCn of findApply(root, 'DetCN')) {
      const [det, cn] = detCn.children
      if (det.kind !== 'apply' || det.constructor !== 'Definite' || cn.kind !== 'apply' || cn.constructor !== 'UseN') continue
      const noun = cn.children[0]
      if (noun.kind !== 'apply') continue
      const split = swedishDefinite[noun.constructor]
      const index = result.findIndex(segment => segment.realizedBy.includes(noun.id))
      if (!split || index < 0 || result[index].text.toLocaleLowerCase('sv') !== `${split[0]}${split[1]}`.toLocaleLowerCase('sv')) continue
      const original = result[index]
      result.splice(index, 1,
        { ...original, id: `${original.id}-root`, text: split[0], realizedBy: [noun.id], categories: ['N'], featureValues: [] },
        { ...original, id: `${original.id}-def`, text: split[1], realizedBy: [noun.id, det.id], categories: ['N', 'Det'], featureValues: ['DEF'] },
      )
    }
  }

  annotateVerbGroup(language, root, result)
  return result
}

function normalizeOne(raw: RawLinearization, root: Node, revision: number): LinearizationProjection {
  const language = raw.to as LanguageId
  const nodesByConstructor = new Map<string, ApplyNode[]>()
  for (const node of preorder(root)) {
    if (node.kind !== 'apply') continue
    const list = nodesByConstructor.get(node.constructor) ?? []
    list.push(node)
    nodesByConstructor.set(node.constructor, list)
  }
  const occurrence = new Map<string, number>()
  let serial = 0
  const base: LinearizedSegment[] = []
  for (const leaf of bracketLeaves(raw.brackets)) {
    const index = occurrence.get(leaf.fun) ?? 0
    const candidates = nodesByConstructor.get(leaf.fun) ?? []
    const node = candidates[Math.min(index, Math.max(0, candidates.length - 1))]
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
  const segments = annotate(language, root, inSurfaceOrder(base, raw.text))
  return { language, text: raw.text, segments, nodeYields: buildYields(root, segments), revision, source: 'gf' }
}

export function normalizeLinearizations(raw: RawLinearization[], root: Node, revision: number): LinearizationProjection[] {
  return raw.map(item => normalizeOne(item, root, revision))
}

function partialSegments(node: Node, language: LanguageId, serial: { value: number }): LinearizedSegment[] {
  if (node.kind === 'hole') {
    return [{
      id: `${language}-partial-${serial.value++}`, text: `⟦${node.expected}⟧`, role: 'hole',
      realizedBy: [node.id], categories: [node.expected], featureValues: [],
    }]
  }
  if (!node.children.length) {
    const text = partialLexicon[language][node.constructor]
    if (!text) return []
    return [{
      id: `${language}-partial-${serial.value++}`, text, role: 'overt',
      realizedBy: [node.id], categories: [node.output], featureValues: [],
    }]
  }
  return node.children.flatMap(child => partialSegments(child, language, serial))
}

export function partialProjections(root: Node, revision: number): LinearizationProjection[] {
  return LANGUAGES.map(language => {
    const segments = partialSegments(root, language, { value: 0 })
    return {
      language,
      text: segments.map(item => item.text).join(' '),
      nodeYields: buildYields(root, segments), segments, revision, source: 'partial',
    }
  })
}
