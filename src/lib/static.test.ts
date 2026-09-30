import { describe, expect, it } from 'vitest'
import { agreementExample, exampleDocument } from './examples'
import { fromGfTerm, toGfTerm } from './editor'
import { CONSTRUCTORS, producers } from './grammar'
import { normalizeLinearizations, type RawLinearization } from './projection'
import { phraseBoxes } from './boxes'
import type { ApplyNode } from './model'
import { grammarJson, oracleIndex, oracleShard, oracleTable, paradigms } from './oracle.testkit'
import { linearizeInBrowser, loadBrowserGrammar } from './browser-gf'
import { LANGUAGE_IDS } from './languages'

/** A complete term is `MkS <Temp> <Pol> (...)`; the Temp constructor names its oracle shard. */
const tenseOf = (term: string) => term.match(/MkS (\w+)/)![1]
const shards = oracleIndex.shards
const table = oracleTable()

describe('precomputed static linearizations', () => {
  it('covers every operation of the grammar at least once (the oracle is a stratified sample)', () => {
    const used = new Set(Object.keys(table).flatMap(term => term.match(/[A-Z]\w*/g) ?? []))
    const missing = CONSTRUCTORS.map(item => item.id).filter(id => !used.has(id))
    expect(missing).toEqual([])
    expect(Object.keys(table)).toHaveLength(oracleIndex.trees)
  })

  it('shards by tense so each tree is found in its own shard', () => {
    expect(shards).toEqual(producers('Temp').map(item => item.id).sort())
    for (const tense of shards) {
      const shard = oracleShard(tense)
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
      "l'[DEF] homme ne[NEG] dorm·ai[PAST]·t[3SG] pas[NEG]",
    ])
    expect(labelled('FuturePerfect')).toEqual([
      "the[DEF] man won't[NEG·FUT] have[PERF] slept[PTCP]",
      'der[DEF] Mann wird[FUT·3SG] nicht[NEG] ge[PTCP]·schlaf·en[PTCP] haben[PERF]',
      'man·nen[DEF] ska[FUT]·∅[3SG] inte[NEG] ha[PERF] sov·it[PTCP]',
      "l'[DEF] homme n'[NEG] aura[FUT·PERF·3SG] pas[NEG] dorm·i[PTCP]",
    ])
  })

  it('serves the worked examples through the same provenance pipeline', () => {
    const agreement = agreementExample()
    const projections = normalizeLinearizations(table[toGfTerm(agreement.root)], agreement.root, 1)
    expect(projections.map(item => item.text)).toEqual(["the man doesn't sleep", 'der Mann schläft nicht', 'mannen sover inte', "l'homme ne dort pas"])
    expect(table[toGfTerm(exampleDocument().root)].map(item => item.text)).toEqual(['I see the woman', 'ich sehe die Frau', 'jag ser kvinnan', 'je vois la femme'])
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

  it('spans a PP inside a German perfect and never treats a preposition as an auxiliary', () => {
    const term = 'MkS PresentPerfect Negative (PredVP (DetCN Definite (UseN ManN)) (AdvVP (UseV SleepV) (PrepNP WithPrep (DetCN Definite (UseN DogN)))))'
    const root = fromGfTerm(term)
    // Not in the oracle's PP sample; the browser runtime is conformance-tested against the server.
    const raw = linearizeInBrowser(loadBrowserGrammar(grammarJson()), term, root, LANGUAGE_IDS)
    const german = normalizeLinearizations(raw, root, 1, paradigms)[1]
    expect(german.text).toBe('der Mann hat nicht mit dem Hund geschlafen')
    const box = (constructor: string) => phraseBoxes(root, german).find(item => item.label === constructor)!
    expect(box('PrepNP').runs).toEqual([[4, 6]])
    expect(box('AdvVP').runs).toEqual([[4, 7]])
    expect(box('PresentPerfect').runs).toEqual([[2, 2], [7, 7]])
    const word = (text: string) => german.segments.find(segment => segment.text === text)!
    expect(word('mit').featureValues).toEqual([])
    expect(word('hat').featureValues).toEqual(['PRES', 'PERF', '3SG'])
    expect(word('dem').featureValues).toEqual(['DEF', 'DAT'])
  })

  it('never overlaps two boxes in a row, for every German sentence in two tenses', () => {
    for (const tense of ['Present', 'FuturePerfect']) {
      const shard = oracleShard(tense)
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
