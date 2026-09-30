export const CATEGORIES = ['S', 'Cl', 'NP', 'VP', 'CN', 'N', 'V', 'V2', 'Det', 'Pron', 'Pol', 'Temp', 'Adv', 'Prep', 'A', 'AP', 'AdA', 'Conj'] as const
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
  /** Attached to the previous word with no space (GF BIND: French l'·homme). */
  bound?: boolean
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
  V: { ink: '#239527', glow: '#84f588', wash: '#e7f9e7' }, // 122°
  VP: { ink: '#23953c', glow: '#84f59d', wash: '#e7f9ea' }, // 133°
  Adv: { ink: '#23954f', glow: '#84f5b0', wash: '#e7f9ee' }, // 143°
  AdA: { ink: '#239561', glow: '#84f5c2', wash: '#e7f9f1' }, // 153°
  A: { ink: '#239576', glow: '#84f5d7', wash: '#e7f9f4' }, // 164°
  AP: { ink: '#239589', glow: '#84f5ea', wash: '#e7f9f7' }, // 174°
  Det: { ink: '#238d95', glow: '#84eef5', wash: '#e7f8f9' }, // 184°
  NP: { ink: '#237895', glow: '#84d9f5', wash: '#e7f4f9' }, // 195°
  CN: { ink: '#236595', glow: '#84c6f5', wash: '#e7f1f9' }, // 205°
  N: { ink: '#235095', glow: '#84b1f5', wash: '#e7eef9' }, // 216°
  Pron: { ink: '#233d95', glow: '#849ff5', wash: '#e7ebf9' }, // 226°
  Prep: { ink: '#232a95', glow: '#848cf5', wash: '#e7e8f9' }, // 236°
  Conj: { ink: '#302395', glow: '#9184f5', wash: '#e9e7f9' }, // 247°
  S: { ink: '#432395', glow: '#a484f5', wash: '#ece7f9' }, // 257°
  Cl: { ink: '#562395', glow: '#b784f5', wash: '#efe7f9' }, // 267°
  Temp: { ink: '#6b2395', glow: '#cc84f5', wash: '#f2e7f9' }, // 278°
  Pol: { ink: '#7e2395', glow: '#df84f5', wash: '#f5e7f9' }, // 288°
}

