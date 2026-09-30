import { CONSTRUCTORS, constructorById } from './grammar'
import { freshId, hole } from './editor'
import { profileOf } from './languages'
import type { Paradigms } from './morphology'
import type { ApplyNode, CategoryId, ConstructorId, LanguageId, Node } from './model'

/** Where a written form comes from: its lexical leaf and the paradigm cells holding it. */
export type FormEntry = { leaf: ConstructorId; language: LanguageId; form: string; cells: string[] }

/** A typed way to fill a hole with what was written, plus the obligations (holes) it leaves. */
export type Candidate = FormEntry & {
  subtree: ApplyNode
  /** Features every matching cell agrees on (schlief → PAST); ambiguous forms pin nothing. */
  pins: string[]
  /** Constructors from the hole's sort down to the leaf, outermost first. */
  path: ConstructorId[]
}

const normalize = (text: string) => text.trim().toLocaleLowerCase()

/**
 * Tense/aspect read off RGL paradigm cell names. The names differ per language
 * (VImpfInd, VPast, VPret), so each pattern covers all three RGLs in use.
 */
const CELL_FEATURES: [RegExp, string][] = [
  [/VPresInd|\bVPres\b|VPres Act/, 'PRES'],
  [/VImpfInd|\bVPast\b|VPret Act/, 'PAST'],
  [/VPPart|VPastPart|VSupin Act/, 'PTCP'],
]
const featuresOfCell = (cell: string) => CELL_FEATURES.filter(([pattern]) => pattern.test(cell)).map(([, feature]) => feature)

/** Every written form of every leaf, per language: GF's paradigm tables plus preview words for leaves without one. */
export function formIndex(paradigms: Paradigms, language: LanguageId): Map<string, FormEntry[]> {
  const index = new Map<string, FormEntry[]>()
  const add = (leaf: ConstructorId, form: string, cell: string) => {
    if (!form) return
    const key = normalize(form)
    const entries = index.get(key) ?? []
    const entry = entries.find(item => item.leaf === leaf)
    if (entry) { if (!entry.cells.includes(cell)) entry.cells.push(cell) }
    else entries.push({ leaf, language, form, cells: [cell] })
    index.set(key, entries)
  }
  const tables = paradigms.tables[language] ?? {}
  for (const [leaf, cells] of Object.entries(tables)) for (const [cell, form] of Object.entries(cells)) add(leaf, form, cell)
  for (const [leaf, form] of Object.entries(profileOf(language).partialLexicon)) {
    if (!tables[leaf] && constructorById.get(leaf)) add(leaf, form, 'citation')
  }
  return index
}

/**
 * The shortest chain of constructors from `target` down to `category`, each
 * step entering one argument (the others become holes): N → NP is
 * DetCN(⟦Det⟧, UseN(·)). Recursive wrappers (VP → VP) are never needed.
 */
export type Chain = { constructor: ConstructorId; input: number }[]

export function chainTo(target: CategoryId, category: CategoryId): Chain | undefined {
  return chainToImpl(target, category)
}

function chainToImpl(target: CategoryId, category: CategoryId): { constructor: ConstructorId; input: number }[] | undefined {
  if (target === category) return []
  const queue: { sort: CategoryId; chain: { constructor: ConstructorId; input: number }[] }[] = [{ sort: target, chain: [] }]
  const seen = new Set<CategoryId>([target])
  while (queue.length) {
    const { sort, chain } = queue.shift()!
    for (const constructor of CONSTRUCTORS) {
      if (constructor.output !== sort) continue
      for (const [input, inputSort] of constructor.inputs.entries()) {
        if (inputSort === sort || seen.has(inputSort)) continue
        const next = [...chain, { constructor: constructor.id, input }]
        if (inputSort === category) return next
        seen.add(inputSort)
        queue.push({ sort: inputSort, chain: next })
      }
    }
  }
}

/** The expression `chain` ∘ `bottom`: the bottom operation gets holes for its own arguments, each step one more. */
export function build(chain: Chain, bottom: ConstructorId): ApplyNode {
  const declaration0 = constructorById.get(bottom)!
  let node: ApplyNode = { kind: 'apply', id: freshId(), constructor: bottom, output: declaration0.output, children: declaration0.inputs.map(hole) }
  for (const { constructor, input } of [...chain].reverse()) {
    const declaration = constructorById.get(constructor)!
    const children: Node[] = declaration.inputs.map(hole)
    children[input] = node
    node = { kind: 'apply', id: freshId(), constructor, output: declaration.output, children }
  }
  return node
}

/** Candidates for filling a hole of sort `target` with a word written in `language`: exact forms first, then prefixes. */
export function candidates(index: Map<string, FormEntry[]>, target: CategoryId, text: string, limit = 8): Candidate[] {
  const query = normalize(text)
  if (!query) return []
  const exact = index.get(query) ?? []
  const prefixed = [...index.entries()].filter(([form]) => form !== query && form.startsWith(query)).flatMap(([, entries]) => entries)
  const result: Candidate[] = []
  const seen = new Set<string>()
  for (const entry of [...exact, ...prefixed]) {
    const leaf = constructorById.get(entry.leaf)
    const chain = leaf && chainTo(target, leaf.output)
    if (!chain || seen.has(`${entry.leaf}:${entry.form}`)) continue
    seen.add(`${entry.leaf}:${entry.form}`)
    const perCell = entry.cells.map(featuresOfCell)
    const pins = perCell.length ? perCell[0].filter(feature => perCell.every(features => features.includes(feature))) : []
    result.push({ ...entry, subtree: build(chain, entry.leaf), pins, path: [...chain.map(step => step.constructor), entry.leaf] })
    if (result.length >= limit) break
  }
  return result
}
