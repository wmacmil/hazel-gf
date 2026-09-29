export const CATEGORIES = ['S', 'Cl', 'NP', 'VP', 'CN', 'N', 'V', 'V2', 'Det', 'Pron', 'Pol', 'Temp'] as const
export type CategoryId = (typeof CATEGORIES)[number]
export type NodeId = string
export type ConstructorId = string

export type Constructor = {
  id: ConstructorId
  label: string
  inputs: CategoryId[]
  output: CategoryId
  editorOnly?: boolean
}

export type HoleNode = { kind: 'hole'; id: NodeId; expected: CategoryId }
export type ApplyNode = {
  kind: 'apply'
  id: NodeId
  constructor: ConstructorId
  output: CategoryId
  children: Node[]
}
export type Node = HoleNode | ApplyNode

export type EditorDocument = {
  schemaVersion: 1
  grammar: { name: 'HazelGF'; fingerprint: 'hazel-gf-v2' }
  startCategory: 'S'
  root: Node
  focus: NodeId
}

/** A GF concrete syntax id declared in languages.json (e.g. HazelGFGer). */
export type LanguageId = string

/** A piece of a word: stem, (changed) stem, affix, function word, or an empty exponent ∅. */
export type Morpheme = {
  text: string
  role: 'stem' | 'changed-stem' | 'affix' | 'function' | 'zero'
  features: string[]
  /** The lexical leaf plus the nodes that control this piece (Temp, subject, Det, Pol). */
  realizedBy: NodeId[]
}

export type LinearizedSegment = {
  id: string
  text: string
  role: 'overt' | 'zero' | 'hole'
  realizedBy: NodeId[]
  categories: CategoryId[]
  featureValues: string[]
  morphemes?: Morpheme[]
}

export type LinearizationProjection = {
  language: LanguageId
  text: string
  segments: LinearizedSegment[]
  nodeYields: Record<NodeId, string[]>
  revision: number
  source: 'gf' | 'partial'
}

/**
 * Operad colors: one hue per sort (GF category), all in the cool half of the
 * wheel (120°–276°). `glow` is for the dark operad panel, `ink`/`wash` for the
 * sort's hairline image on the algebra's paper. Feature colors live in the
 * warm half (style.ts), so the two channels can never be confused.
 */
export const CATEGORY_COLORS: Record<CategoryId, { ink: string; glow: string; wash: string }> = {
  V2: { ink: '#239523', glow: '#84f584', wash: '#e7f9e7' }, // 120°
  V: { ink: '#23953d', glow: '#84f59f', wash: '#e7f9eb' }, // 134°
  VP: { ink: '#239558', glow: '#84f5b9', wash: '#e7f9ef' }, // 148°
  Det: { ink: '#23957a', glow: '#84f5db', wash: '#e7f9f5' }, // 166°
  NP: { ink: '#239195', glow: '#84f1f5', wash: '#e7f8f9' }, // 182°
  CN: { ink: '#237495', glow: '#84d5f5', wash: '#e7f4f9' }, // 197°
  N: { ink: '#235895', glow: '#84b9f5', wash: '#e7eff9' }, // 212°
  Pron: { ink: '#233d95', glow: '#849ff5', wash: '#e7ebf9' }, // 226°
  S: { ink: '#232395', glow: '#8484f5', wash: '#e7e7f9' }, // 240°
  Cl: { ink: '#3a2395', glow: '#9b84f5', wash: '#eae7f9' }, // 252°
  Temp: { ink: '#502395', glow: '#b184f5', wash: '#eee7f9' }, // 264°
  Pol: { ink: '#672395', glow: '#c884f5', wash: '#f2e7f9' }, // 276°
}

