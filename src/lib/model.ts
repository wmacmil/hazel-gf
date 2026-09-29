export const CATEGORIES = ['S', 'Cl', 'NP', 'VP', 'CN', 'N', 'V', 'V2', 'Det', 'Pron', 'Pol', 'Temp', 'Adv', 'Prep'] as const
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
 * wheel (112°–288°). `glow` is for the dark operad panel, `ink`/`wash` for the
 * sort's hairline image on the algebra's paper. Feature colors live in the
 * warm half (style.ts), so the two channels can never be confused.
 */
export const CATEGORY_COLORS: Record<CategoryId, { ink: string; glow: string; wash: string }> = {
  V2: { ink: '#329523', glow: '#93f584', wash: '#e9f9e7' }, // 112°
  V: { ink: '#23952e', glow: '#84f590', wash: '#e7f9e8' }, // 126°
  VP: { ink: '#239547', glow: '#84f5a8', wash: '#e7f9ec' }, // 139°
  Adv: { ink: '#239561', glow: '#84f5c2', wash: '#e7f9f1' }, // 153°
  Det: { ink: '#23957a', glow: '#84f5db', wash: '#e7f9f5' }, // 166°
  NP: { ink: '#239595', glow: '#84f5f5', wash: '#e7f9f9' }, // 180°
  CN: { ink: '#237c95', glow: '#84ddf5', wash: '#e7f5f9' }, // 193°
  N: { ink: '#236195', glow: '#84c2f5', wash: '#e7f1f9' }, // 207°
  Pron: { ink: '#234995', glow: '#84aaf5', wash: '#e7edf9' }, // 220°
  Prep: { ink: '#232e95', glow: '#8490f5', wash: '#e7e8f9' }, // 234°
  S: { ink: '#302395', glow: '#9184f5', wash: '#e9e7f9' }, // 247°
  Cl: { ink: '#4b2395', glow: '#ac84f5', wash: '#ede7f9' }, // 261°
  Temp: { ink: '#632395', glow: '#c484f5', wash: '#f1e7f9' }, // 274°
  Pol: { ink: '#7e2395', glow: '#df84f5', wash: '#f5e7f9' }, // 288°
}

