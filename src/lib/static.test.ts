import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agreementExample, exampleDocument } from './examples'
import { toGfTerm } from './editor'
import { producers } from './grammar'
import { normalizeLinearizations, type RawLinearization } from './projection'
import { tenseOf } from './gf'
import type { ApplyNode, CategoryId } from './model'

const staticDir = resolve(__dirname, '../../public/static')
const { shards } = JSON.parse(readFileSync(resolve(staticDir, 'index.json'), 'utf8')) as { shards: string[] }
const table: Record<string, RawLinearization[]> = Object.assign({}, ...shards.map(tense =>
  JSON.parse(readFileSync(resolve(staticDir, `linearizations-${tense}.json`), 'utf8'))))

/** Number of complete trees of a category, counted from the editor's own palette. */
function completeTrees(category: CategoryId): number {
  return producers(category).reduce(
    (total, constructor) => total + constructor.inputs.reduce((product, input) => product * completeTrees(input), 1), 0)
}

describe('precomputed static linearizations', () => {
  it('covers exactly the complete S trees the editor can build', () => {
    expect(Object.keys(table)).toHaveLength(completeTrees('S'))
  })

  it('shards by tense so each tree is found in its own shard', () => {
    expect(shards).toEqual(producers('Temp').map(item => item.id).sort())
    for (const tense of shards) {
      const shard = JSON.parse(readFileSync(resolve(staticDir, `linearizations-${tense}.json`), 'utf8')) as Record<string, unknown>
      expect(Object.keys(shard).every(term => tenseOf(term) === tense)).toBe(true)
    }
  })

  it('puts tense on the finite element and agreement only where each language marks it', () => {
    const labelled = (tense: string) => {
      const document = agreementExample()
      const root = document.root as ApplyNode
      root.children[0] = { ...root.children[0], constructor: tense } as ApplyNode
      return normalizeLinearizations(table[toGfTerm(root)], root, 1).map(projection =>
        projection.segments.map(segment => `${segment.text}${segment.featureValues.length ? `[${segment.featureValues.join('·')}]` : ''}`).join(' '))
    }
    expect(labelled('Past')).toEqual([
      "the[DEF] man didn't[NEG·PAST] sleep",
      'der[DEF] Mann schlief[PAST·3SG] nicht[NEG]',
      'man nen[DEF] sov[PAST] ∅[3SG] inte[NEG]',
    ])
    expect(labelled('FuturePerfect')).toEqual([
      "the[DEF] man won't[NEG·FUT] have[PERF] slept[PTCP]",
      'der[DEF] Mann wird[FUT·3SG] nicht[NEG] geschlafen[PTCP] haben[PERF]',
      'man nen[DEF] ska[FUT] ∅[3SG] inte[NEG] ha[PERF] sovit[PTCP]',
    ])
  })

  it('serves the worked examples through the same provenance pipeline', () => {
    const agreement = agreementExample()
    const projections = normalizeLinearizations(table[toGfTerm(agreement.root)], agreement.root, 1)
    expect(projections.map(item => item.text)).toEqual(["the man doesn't sleep", 'der Mann schläft nicht', 'mannen sover inte'])
    expect(table[toGfTerm(exampleDocument().root)].map(item => item.text)).toEqual(['I see the woman', 'ich sehe die Frau', 'jag ser kvinnan'])
  })
})
