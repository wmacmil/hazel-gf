import { fromJSON, type GFGrammar } from '../../vendor/gf-typescript/index'
import type { Node } from './model'
import type { RawBracket, RawLinearization } from './projection'

export type BrowserGrammar = GFGrammar

export const loadBrowserGrammar = (json: unknown): BrowserGrammar => {
  const grammar = fromJSON(json as never)
  if (!grammar) throw new Error('Could not read the PGF JSON grammar')
  return grammar
}

/** The editor node at a gf-typescript tag path: `0` is the root, `0-2-1` its third child's second child. */
function nodeAtTag(root: Node, tag: string): Node | undefined {
  let node: Node | undefined = root
  for (const index of tag.split('-').slice(1)) node = node?.kind === 'apply' ? node.children[Number(index)] : undefined
  return node
}

/**
 * Linearize a complete tree in every concrete syntax, in the browser. Each
 * token is tagged by gf-typescript with the path of the node whose
 * linearization rule emitted it, so provenance is exact: the result is the
 * same RawLinearization shape the GF server returns, with `node` set.
 */
export function linearizeInBrowser(grammar: BrowserGrammar, term: string, root: Node, languages: string[]): RawLinearization[] {
  const tree = grammar.abstract.parseTree(term)
  if (!tree) throw new Error(`GF could not read ${term}`)
  return languages.map(language => {
    const concrete = grammar.concretes[language]
    if (!concrete) throw new Error(`The grammar has no concrete syntax ${language}`)
    const brackets: RawBracket[] = concrete.tagAndLinearize(tree).map(({ s, tag }: { s: string; tag: string }) => {
      const node = nodeAtTag(root, tag)
      const fun = node?.kind === 'apply' ? node.constructor : '?'
      return { fun, cat: node?.kind === 'apply' ? node.output : '?', fid: 0, index: 0, node: node?.id, children: [{ token: s }] }
    })
    // gf-typescript leaves GF's BIND token (&+) in its text; the server joins it (l' &+ homme → l'homme).
    return { to: language, text: String(concrete.linearize(tree)).replace(/\s*&\+\s*/g, '').replace(/\s+/g, ' ').trim(), brackets }
  })
}
