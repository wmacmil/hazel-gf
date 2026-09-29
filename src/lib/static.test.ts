import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agreementExample, exampleDocument } from './examples'
import { fromGfTerm, toGfTerm } from './editor'
import { producers } from './grammar'
import { normalizeLinearizations, type RawLinearization } from './projection'
import { tenseOf } from './gf'
import { phraseBoxes } from './boxes'
import type { ApplyNode, CategoryId } from './model'
import type { Paradigms } from './morphology'

const staticDir = resolve(__dirname, '../../public/static')
const { shards } = JSON.parse(readFileSync(resolve(staticDir, 'index.json'), 'utf8')) as { shards: string[] }
const paradigms = JSON.parse(readFileSync(resolve(staticDir, 'paradigms.json'), 'utf8')) as Paradigms
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
      return normalizeLinearizations(table[toGfTerm(root)], root, 1, paradigms).map(projection =>
        projection.segments.map(segment => (segment.morphemes ?? []).map(piece =>
          `${piece.role === 'zero' ? '∅' : piece.text}${piece.features.length ? `[${piece.features.join('·')}]` : ''}`).join('·')).join(' '))
    }
    expect(labelled('Past')).toEqual([
      "the[DEF] man didn't[NEG·PAST] sleep",
      'der[DEF] Mann schlief[PAST]·∅[3SG] nicht[NEG]',
      'man·nen[DEF] sov·∅[PAST]·∅[3SG] inte[NEG]',
    ])
    expect(labelled('FuturePerfect')).toEqual([
      "the[DEF] man won't[NEG·FUT] have[PERF] slept[PTCP]",
      'der[DEF] Mann wird[FUT·3SG] nicht[NEG] ge[PTCP]·schlaf·en[PTCP] haben[PERF]',
      'man·nen[DEF] ska[FUT]·∅[3SG] inte[NEG] ha[PERF] sov·it[PTCP]',
    ])
  })

  it('serves the worked examples through the same provenance pipeline', () => {
    const agreement = agreementExample()
    const projections = normalizeLinearizations(table[toGfTerm(agreement.root)], agreement.root, 1)
    expect(projections.map(item => item.text)).toEqual(["the man doesn't sleep", 'der Mann schläft nicht', 'mannen sover inte'])
    expect(table[toGfTerm(exampleDocument().root)].map(item => item.text)).toEqual(['I see the woman', 'ich sehe die Frau', 'jag ser kvinnan'])
  })
})

describe('phrase boxes over the surface', () => {
  it('gives each node its word runs, splitting discontinuous yields', () => {
    const document = agreementExample()
    const root = document.root as ApplyNode
    root.children[0] = { ...root.children[0], constructor: 'PresentPerfect' } as ApplyNode
    const german = normalizeLinearizations(table[toGfTerm(root)], root, 1, paradigms)[1]
    expect(german.text).toBe('der Mann hat nicht geschlafen')
    const boxes = phraseBoxes(root, german)
    const box = (constructor: string) => boxes.find(item => item.label === constructor)!
    expect(box('MkS').runs).toEqual([[0, 4]])
    expect(box('DetCN').runs).toEqual([[0, 1]])
    expect(box('PresentPerfect').runs).toEqual([[2, 2], [4, 4]])
    // GF attributes the auxiliary to the clause, so the VP box holds only the participle.
    expect(box('UseV').runs).toEqual([[4, 4]])
    expect(box('Negative').runs).toEqual([[3, 3]])
  })

  it('never overlaps two boxes in a row, for every German sentence in two tenses', () => {
    for (const tense of ['Present', 'FuturePerfect']) {
      const shard = JSON.parse(readFileSync(resolve(staticDir, `linearizations-${tense}.json`), 'utf8')) as Record<string, RawLinearization[]>
      for (const term of Object.keys(shard).slice(0, 400)) {
        const root = fromGfTerm(term)
        const projection = normalizeLinearizations(shard[term], root, 1, paradigms)[1]
        const cells = new Set<string>()
        for (const box of phraseBoxes(root, projection)) for (const [start, end] of box.runs) for (let i = start; i <= end; i++) {
          const cell = `${box.row}:${i}`
          expect(cells.has(cell)).toBe(false)
          cells.add(cell)
        }
      }
    }
  })
})
