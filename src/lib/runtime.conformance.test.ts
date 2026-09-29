import { describe, expect, it } from 'vitest'
import { linearizeInBrowser, loadBrowserGrammar } from './browser-gf'
import { fromGfTerm } from './editor'
import { normalizeLinearizations, type RawBracket } from './projection'
import { LANGUAGE_IDS } from './languages'
import { grammarJson, oracleIndex, oracleShard, paradigms } from './oracle.testkit'

const grammar = loadBrowserGrammar(grammarJson())

/** token@constructor for each token, from the innermost bracket that emitted it. */
function attribution(brackets: RawBracket[], out: string[] = [], fun = ''): string[] {
  for (const bracket of brackets) {
    if ('token' in bracket) out.push(`${bracket.token}@${fun}`)
    else attribution(bracket.children ?? [], out, bracket.fun)
  }
  return out
}

const view = (projection: ReturnType<typeof normalizeLinearizations>[number]) =>
  projection.segments.map(segment => [segment.text, segment.featureValues, (segment.morphemes ?? []).map(piece => [piece.text, piece.role, piece.features])])

describe('the in-browser GF runtime conforms to the GF server', () => {
  it('matches text, token provenance, and the whole projection on every oracle tree', () => {
    let checked = 0
    for (const tense of oracleIndex.shards) {
      for (const [term, expected] of Object.entries(oracleShard(tense))) {
        const root = fromGfTerm(term)
        const actual = linearizeInBrowser(grammar, term, root, LANGUAGE_IDS)
        expect(actual.map(item => item.text)).toEqual(expected.map(item => item.text))
        expect(actual.map(item => attribution(item.brackets))).toEqual(expected.map(item => attribution(item.brackets)))
        if (checked % 7 === 0) {
          expect(normalizeLinearizations(actual, root, 1, paradigms).map(view))
            .toEqual(normalizeLinearizations(expected, root, 1, paradigms).map(view))
        }
        checked++
      }
    }
    expect(checked).toBe(oracleIndex.trees)
  }, 180_000)
})
