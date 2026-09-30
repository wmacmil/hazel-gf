import { describe, expect, it } from 'vitest'
import { loadBrowserGrammar } from './browser-gf'
import { findNode, fromGfTerm, fromPartialTerm, outputOf, preorder, toGfTerm, toPartialTerm } from './editor'
import { cut, extend, graftCandidates, substitute } from './graft'
import { grammarJson, paradigms } from './oracle.testkit'
import { parsePhrase, terminalsOf } from './parsing'
import type { ApplyNode, CategoryId, Node } from './model'

const json = grammarJson()
const grammar = loadBrowserGrammar(json)
const phrase = (language: string, text: string, target: CategoryId | undefined) =>
  parsePhrase(grammar, language, text, terminalsOf(json, language), target).map(reading => reading.term)
const byName = (root: Node, name: string) => preorder(root).find(node => node.kind === 'apply' && node.constructor === name)!

describe('phrases parse at any sort, lifted into the hole', () => {
  it('a CN lifts into an NP hole, leaving the determiner as an obligation', () => {
    expect(phrase('HazelGFEng', 'small dog', 'NP')).toEqual(['DetCN ?Det (AdjCN (PositA SmallA) (UseN DogN))'])
  })
  it('_ is a typed hole the grammar places', () => {
    expect(phrase('HazelGFEng', 'the _ dog', 'NP')[0]).toBe('DetCN Definite (AdjCN ?AP (UseN DogN))')
    expect(phrase('HazelGFEng', '_ and the woman', 'NP')).toEqual(['ConjNP AndConj ?NP (DetCN Definite (UseN WomanN))'])
  })
  it('placeholders that reuse real words are not holes unless typed (the ≠ ?Det)', () => {
    expect(phrase('HazelGFEng', 'the dog', 'NP')).toEqual(['DetCN Definite (UseN DogN)'])
  })
  it('a VP parses inside a clause frame, whatever the agreement', () => {
    for (const text of ['sleeps in the house', 'sleep in the house']) {
      expect(phrase('HazelGFEng', text, 'VP')).toEqual(['AdvVP (UseV SleepV) (PrepNP InPrep (DetCN Definite (UseN HouseN)))'])
    }
  })
  it('works in every language', () => {
    expect(phrase('HazelGFGer', 'der kleine Hund', 'NP')).toContain('DetCN Definite (AdjCN (PositA SmallA) (UseN DogN))')
    expect(phrase('HazelGFSwe', 'den lilla hunden', 'NP')).toContain('DetCN Definite (AdjCN (PositA SmallA) (UseN DogN))')
  })
  it('with no target, a phrase is read at its own sort', () => {
    expect(phrase('HazelGFEng', 'small dog', undefined)).toEqual(['AdjCN (PositA SmallA) (UseN DogN)'])
  })
  it('unknown words fail fast with nothing', () => {
    expect(phrase('HazelGFEng', 'small zebra', 'NP')).toEqual([])
  })
})

describe('graft kernel', () => {
  const sentence = () => fromGfTerm('MkS Present Positive (PredVP (DetCN Definite (UseN ManN)) (UseV SleepV))')
  it('substitute fills a hole and focuses the first obligation', () => {
    const root = fromPartialTerm('MkS Present Positive (PredVP ?NP (UseV SleepV))')
    const gap = preorder(root).find(node => node.kind === 'hole')!
    const edit = substitute(root, gap.id, fromPartialTerm('DetCN ?Det (UseN DogN)'))
    expect(toPartialTerm(edit.root)).toBe('MkS Present Positive (PredVP (DetCN ?Det (UseN DogN)) (UseV SleepV))')
    expect(outputOf(findNode(edit.root, edit.focus)!)).toBe('Det')
    expect(edit.displaced).toBeUndefined()
  })
  it('substituting a filled node hands the old subtree back', () => {
    const root = sentence()
    const edit = substitute(root, byName(root, 'DetCN').id, fromGfTerm('UsePron ShePron'))
    expect(toGfTerm(edit.displaced!)).toBe('DetCN Definite (UseN ManN)')
    expect(toGfTerm(edit.root)).toContain('PredVP (UsePron ShePron)')
  })
  it('extend puts the node into the new expression’s hole of its sort', () => {
    const root = sentence()
    const edit = extend(root, byName(root, 'DetCN').id, fromPartialTerm('ConjNP AndConj ?NP (DetCN Definite (UseN WomanN))'))
    expect(toGfTerm(edit.root)).toBe('MkS Present Positive (PredVP (ConjNP AndConj (DetCN Definite (UseN ManN)) (DetCN Definite (UseN WomanN))) (UseV SleepV))')
    expect(() => extend(root, byName(root, 'DetCN').id, fromGfTerm('UsePron ShePron'))).toThrow(/no NP hole/)
  })
  it('extend with an operation focuses what is left to fill', () => {
    const root = sentence()
    const edit = extend(root, byName(root, 'UseV').id, fromPartialTerm('AdvVP ?VP ?Adv'))
    expect(outputOf(findNode(edit.root, edit.focus)!)).toBe('Adv')
  })
  it('cut leaves a hole and returns the subtree', () => {
    const root = sentence()
    const edit = cut(root, byName(root, 'UseV').id)!
    expect(toPartialTerm(edit.root)).toBe('MkS Present Positive (PredVP (DetCN Definite (UseN ManN)) ?VP)')
    expect(toGfTerm(edit.displaced!)).toBe('UseV SleepV')
  })
})

describe('graft candidates', () => {
  const bench = { fragments: [fromGfTerm('DetCN Definite (UseN DogN)'), fromGfTerm('UseV SleepV')] }
  const parsed = [{ expression: fromPartialTerm('DetCN ?Det (AdjCN (PositA SmallA) (UseN DogN))'), text: 'small dog', language: 'HazelGFEng', via: ['DetCN'] }]
  it('every candidate fits the sort', () => {
    for (const mode of ['insert', 'graft'] as const) {
      const found = graftCandidates({ mode, sort: 'NP', query: 'small dog', parsed, bench, paradigms })
      expect(found.length).toBeGreaterThan(0)
      for (const candidate of found) expect(outputOf(candidate.expression)).toBe('NP')
    }
  })
  it('insert puts parses first; graft puts the bench first', () => {
    expect(graftCandidates({ mode: 'insert', sort: 'NP', query: 'small dog', parsed, bench, paradigms })[0].source).toBe('parse')
    expect(graftCandidates({ mode: 'graft', sort: 'NP', query: '', parsed: [], bench, paradigms })[0].source).toBe('bench')
  })
  it('an empty query lists every operation returning the sort', () => {
    const names = graftCandidates({ mode: 'insert', sort: 'Pol', query: '', parsed: [], bench, paradigms }).map(item => item.title)
    expect(names).toEqual(expect.arrayContaining(['Positive', 'Negative']))
  })
  it('extend offers only wrappers with a hole of the sort', () => {
    const found = graftCandidates({ mode: 'extend', sort: 'VP', query: '', parsed: [], bench, paradigms })
    expect(found.map(item => item.title)).toEqual(expect.arrayContaining(['AdvVP']))
    for (const candidate of found) expect(preorder(candidate.expression).some(node => node.kind === 'hole' && node.expected === 'VP')).toBe(true)
  })
  it('a fragment is never offered into itself', () => {
    const found = graftCandidates({ mode: 'graft', sort: 'NP', query: '', parsed: [], bench, paradigms, excluded: bench.fragments[0].id })
    expect(found.some(item => item.fragment === bench.fragments[0].id)).toBe(false)
  })
})
