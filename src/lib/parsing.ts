import type { BrowserGrammar } from './browser-gf'
import { constructorById } from './grammar'
import { freshId, hole, toGfTerm, toPartialTerm } from './editor'
import { CATEGORIES, type CategoryId } from './model'
import { chainTo, wrapIn } from './writing'
import type { Node } from './model'

/**
 * The other direction of the same grammar: text in one algebra → trees of the
 * operad. GF parses in the browser (vendor/gf-typescript), so nothing is
 * pregenerated; this module adds what an editor needs on top of GF's parser.
 */

/** Every word the concrete syntax can emit, read from the compiled PGF JSON (minus the editor's ⟦hole⟧ placeholders). */
export function terminalsOf(grammarJson: unknown, language: string): Set<string> {
  const terminals = new Set<string>()
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(walk); return }
    if (!value || typeof value !== 'object') return
    const symbol = value as { type?: string; args?: unknown[] }
    if (symbol.type === 'SymKS') symbol.args?.flat().forEach(token => typeof token === 'string' && token && !token.includes('⟦') && terminals.add(token))
    Object.values(value).forEach(walk)
  }
  walk((grammarJson as { concretes: Record<string, { sequences: unknown }> }).concretes[language]?.sequences)
  return terminals
}

const tokenize = (text: string) => text.replace(/[.,!?;:]+/g, ' ').split(/\s+/).filter(Boolean)

/**
 * Readings of the input to try, cheapest first: as typed; with a
 * sentence-initial capital dropped (The → the); with words the grammar only
 * knows capitalized repaired (German mann → Mann).
 */
export function spellings(tokens: string[], terminals: Set<string>): string[][] {
  const lowerFirst = tokens.map((token, index) =>
    index === 0 && !terminals.has(token) && terminals.has(token.toLowerCase()) ? token.toLowerCase() : token)
  const capitalized = (list: string[]) => list.map(token => {
    const upper = token.charAt(0).toUpperCase() + token.slice(1)
    return upper !== token && terminals.has(upper) ? upper : token
  })
  const seen = new Set<string>()
  return [tokens, lowerFirst, capitalized(tokens), capitalized(lowerFirst)].filter(list => {
    const key = list.join(' ')
    return !seen.has(key) && (seen.add(key), true)
  })
}

type GfTree = { name: string; args: GfTree[] }

/** A GF tree as an editor tree; undefined if it uses an editor-only Hole* function. */
function toNode(tree: GfTree): Node | undefined {
  const declaration = constructorById.get(tree.name)
  if (!declaration || declaration.editorOnly || tree.name.startsWith('Hole')) return undefined
  const children: Node[] = []
  for (const arg of tree.args) {
    const child = toNode(arg)
    if (!child) return undefined
    children.push(child)
  }
  return { kind: 'apply', id: freshId(), constructor: declaration.id, output: declaration.output, children }
}

export type ParseResult =
  | { status: 'parsed'; read: string[]; terms: string[] }
  | { status: 'failed'; read: string[]; consumed: number; unknown: string[]; expected: string[] }

/**
 * Parse a sentence of `language` into GF terms (distinct readings, holes
 * excluded). On failure, mark it: how many words parsed, which words the
 * grammar does not know, and what GF would accept next.
 */
export function parseSentence(grammar: BrowserGrammar, language: string, text: string, terminals: Set<string>): ParseResult {
  const concrete = grammar.concretes[language]
  if (!concrete) throw new Error(`The grammar has no concrete syntax ${language}`)
  const tokens = tokenize(text)
  let best = { read: tokens, consumed: -1 }
  for (const read of spellings(tokens, terminals)) {
    const { trees, consumed } = concrete.parseTokens(read, 'S') as { trees: GfTree[]; consumed: number }
    const terms = [...new Set(trees.map(toNode).filter((node): node is Node => Boolean(node)).map(toGfTerm))]
    if (terms.length) return { status: 'parsed', read, terms }
    if (consumed > best.consumed) best = { read, consumed }
  }
  const { read, consumed } = best
  const unknown = read.filter(token => !terminals.has(token))
  // What GF accepts next after the parsed prefix (for an incomplete sentence, after all of it).
  const expected = [...new Set(concrete.complete(`${read.slice(0, Math.max(consumed, 0)).join(' ')} `, 'S').suggestions as string[])]
    .filter(word => terminals.has(word)).sort()
  return { status: 'failed', read, consumed: Math.max(consumed, 0), unknown, expected }
}


/**
 * What tells readings apart: for each term, the constructors it uses more
 * often than some other reading does (I see the woman with the dog:
 * AdvVP — the PP modifies the seeing — versus AdvCN — it modifies the woman).
 */
export function distinguishing(terms: string[]): Record<string, string[]> {
  const counts = terms.map(term => {
    const tally = new Map<string, number>()
    for (const name of term.match(/[A-Za-z]\w*/g) ?? []) tally.set(name, (tally.get(name) ?? 0) + 1)
    return tally
  })
  return Object.fromEntries(terms.map((term, index) => {
    const mine = counts[index]
    const unique = [...mine.keys()].filter(name => counts.some((other, j) => j !== index && (other.get(name) ?? 0) < mine.get(name)!))
    return [term, unique.sort()]
  }))
}

/** A GF tree as an editor tree where the grammar's Hole* placeholders become typed holes. */
function toPartialNode(tree: GfTree): Node | undefined {
  if (tree.name.startsWith('Hole')) {
    const sort = tree.name.slice(4)
    return (CATEGORIES as readonly string[]).includes(sort) ? hole(sort as CategoryId) : undefined
  }
  const declaration = constructorById.get(tree.name)
  if (!declaration || declaration.editorOnly) return undefined
  const children: Node[] = []
  for (const arg of tree.args) {
    const child = toPartialNode(arg)
    if (!child) return undefined
    children.push(child)
  }
  return { kind: 'apply', id: freshId(), constructor: declaration.id, output: declaration.output, children }
}

const holesIn = (node: Node): number => node.kind === 'hole' ? 1 : node.children.reduce((sum, child) => sum + holesIn(child), 0)

/** Typed words: `_` (or `?`) is a hole to be resolved by the grammar. */
const HOLE_MARKERS = new Set(['_', '?'])

type Frame = { category: string; subject?: string; extract: (tree: GfTree) => GfTree | undefined }
const predicateOf = (tree: GfTree) => tree.name === 'PredVP' ? tree.args[1] : undefined
/**
 * Sorts GF cannot parse on their own, because their surface is split over
 * several fields (a VP's verb and complement; a Cl's tensed forms): parse them
 * inside a clause or sentence around them and take them back out. A VP is
 * tried after a third-person, a first-person, and a plural subject, so
 * *sleeps*, *sleep* and *schlafe* all read as a VP.
 */
const FRAMES: Partial<Record<CategoryId, Frame[]>> = {
  VP: ['HoleNP', 'UsePron IPron', 'UsePron TheyPron', 'UsePron YouPron'].map(subject => ({ category: 'Cl', subject, extract: predicateOf })),
  Cl: [{ category: 'S', extract: tree => tree.name === 'MkS' ? tree.args[2] : undefined }],
}

/** A parsed phrase: a partial term (holes as `?Sort`), the sort it parsed at, and the chain lifting it to the target. */
export type PhraseReading = { term: string; category: CategoryId; language: string; via: string[] }

/**
 * Parse a phrase — not only a sentence — for a hole of sort `target`: at the
 * target itself and at every sort that chains into it (*small dog* is a CN,
 * lifted into an NP hole as `DetCN ?Det (AdjCN …)`), or at every sort when
 * there is no target. A `_` stands for a hole: GF's own completion says which
 * typed placeholder fits there (*the _ dog* → an AP hole), so the result is a
 * partial tree with its obligations. Unknown words fail fast.
 */
export function parsePhrase(grammar: BrowserGrammar, language: string, text: string, terminals: Set<string>, target: CategoryId | undefined, limit = 12): PhraseReading[] {
  const concrete = grammar.concretes[language]
  if (!concrete) return []
  const tokens = text.replace(/[.,!;:]+/g, ' ').split(/\s+/).filter(Boolean)
  if (!tokens.length || tokens.every(token => HOLE_MARKERS.has(token))) return []
  const words = (read: string[]) => read.filter(token => !HOLE_MARKERS.has(token))
  const readings = spellings(tokens, terminals).filter(read => words(read).every(token => terminals.has(token)))
  if (!readings.length) return []
  const sorts = (CATEGORIES as readonly CategoryId[])
    .map(category => ({ category, chain: target ? chainTo(target, category) : [] }))
    .filter((entry): entry is { category: CategoryId; chain: NonNullable<ReturnType<typeof chainTo>> } => Boolean(entry.chain))
    .sort((a, b) => a.chain.length - b.chain.length)
  const found = new Map<string, PhraseReading & { size: number }>()
  // Shortest lift first, and stop at the first length that parses: a reading at
  // the target itself beats the same words lifted from below (GF's German
  // prediction is slow, so this also bounds the work).
  const lengths = [...new Set(sorts.map(entry => entry.chain.length))]
  for (const length of lengths) {
    if (found.size) break
    for (const read of readings) for (const { category, chain } of sorts.filter(entry => entry.chain.length === length)) {
      const markers = read.filter(token => HOLE_MARKERS.has(token)).length
      const frames = FRAMES[category] ?? [{ category, extract: (tree: GfTree) => tree }]
      const before = found.size
      for (const frame of frames) if (found.size === before) for (const filled of resolveHoles(concrete, [...subjectTokens(grammar, language, frame.subject), ...read], frame.category)) {
        let trees: GfTree[]
        // Some sorts' extra fields are empty in some languages (a German CN), which
        // gives GF's extractor a cyclic forest; such a sort just yields nothing.
        try { trees = (concrete.parseTokens(filled, frame.category) as { trees: GfTree[] }).trees } catch { continue }
        for (const tree of trees) {
          const inner = frame.extract(tree)
          const node = inner && toPartialNode(inner)
          // Some placeholders reuse real words (the hole Det is "the"): a hole counts only where a `_` was typed.
          if (!node || holesIn(node) !== markers) continue
          const lifted = wrapIn(chain, node)
          const term = toPartialTerm(lifted)
          if (!found.has(term)) found.set(term, { term, category, language, via: chain.map(step => step.constructor), size: term.split(' ').length })
        }
      }
    }
  }
  // Smallest first: the reading with the fewest extra constructors (a CN hole before an N hole under UseN).
  return [...found.values()].sort((a, b) => a.via.length - b.via.length || a.size - b.size).slice(0, limit).map(({ size: _, ...reading }) => reading)
}

/** A frame's subject as tokens in `language` (⟦NP⟧, I, ich, jag …). */
function subjectTokens(grammar: BrowserGrammar, language: string, subject: string | undefined): string[] {
  if (!subject) return []
  const tree = grammar.abstract.parseTree(subject)
  return tree ? String(grammar.concretes[language].linearize(tree)).split(/\s+/).filter(Boolean) : []
}

/** Every way to replace the `_` markers by a typed hole placeholder GF accepts there (a few at most). */
function resolveHoles(concrete: BrowserGrammar['concretes'][string], tokens: string[], category: string, budget = 24): string[][] {
  const at = tokens.findIndex(token => HOLE_MARKERS.has(token))
  if (at < 0) return [tokens]
  const prefix = tokens.slice(0, at).join(' ')
  let suggestions: string[] = []
  try { suggestions = concrete.complete(`${prefix} `, category).suggestions as string[] } catch { return [] }
  const placeholders = [...new Set(suggestions.filter(word => word.startsWith('⟦')))]
  const results: string[][] = []
  for (const placeholder of placeholders) {
    for (const rest of resolveHoles(concrete, [...tokens.slice(0, at), placeholder, ...tokens.slice(at + 1)], category, budget - results.length)) {
      results.push(rest)
      if (results.length >= budget) return results
    }
  }
  return results
}
