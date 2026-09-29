import type { BrowserGrammar } from './browser-gf'
import { constructorById } from './grammar'
import { freshId, toGfTerm } from './editor'
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
