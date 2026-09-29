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

export type LanguageId = 'HazelGFEng' | 'HazelGFGer' | 'HazelGFSwe'

export type LinearizedSegment = {
  id: string
  text: string
  role: 'overt' | 'zero' | 'hole'
  realizedBy: NodeId[]
  categories: CategoryId[]
  featureValues: string[]
}

export type LinearizationProjection = {
  language: LanguageId
  text: string
  segments: LinearizedSegment[]
  nodeYields: Record<NodeId, string[]>
  revision: number
  source: 'gf' | 'partial'
}

export const CATEGORY_COLORS: Record<CategoryId, { ink: string; wash: string }> = {
  S: { ink: '#8a341b', wash: '#fbe7df' },
  Cl: { ink: '#a34f17', wash: '#f9e9d8' },
  NP: { ink: '#175f72', wash: '#dff2f5' },
  VP: { ink: '#27633a', wash: '#e3f3e7' },
  CN: { ink: '#1d6691', wash: '#e1eff8' },
  N: { ink: '#2456a4', wash: '#e4ecfb' },
  V: { ink: '#247049', wash: '#e1f2e8' },
  V2: { ink: '#16705f', wash: '#def3ee' },
  Det: { ink: '#8b4e00', wash: '#f8eaca' },
  Pron: { ink: '#6b43a5', wash: '#eee5fa' },
  Pol: { ink: '#a22f5c', wash: '#f8e1eb' },
  Temp: { ink: '#5b4a9e', wash: '#ebe7f8' },
}

export const languageLabels: Record<LanguageId, string> = {
  HazelGFEng: 'English',
  HazelGFGer: 'Deutsch',
  HazelGFSwe: 'Svenska',
}
