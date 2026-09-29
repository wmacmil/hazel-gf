import { describe, expect, it } from 'vitest'
import {
  clearFocused, fillFocused, findNode, isComplete, newDocument, outputOf, toGfTerm,
  swapLeaf, validateDocument, wrapFocused,
} from './editor'
import { exampleDocument } from './examples'

describe('typed structure editing', () => {
  it('fills a hole only with an operation producing its color', () => {
    const blank = newDocument()
    const sentence = fillFocused(blank, 'MkS')
    expect(outputOf(sentence.root)).toBe('S')
    expect(findNode(sentence.root, sentence.focus)?.kind).toBe('hole')
    expect(outputOf(findNode(sentence.root, sentence.focus)!)).toBe('Temp')
    expect(() => fillFocused(blank, 'PredVP')).toThrow(/does not match/)
  })

  it('clears without losing the required category', () => {
    const example = exampleDocument()
    const focused = findNode(example.root, example.focus)!
    const cleared = clearFocused(example)
    expect(findNode(cleared.root, cleared.focus)).toEqual({ kind: 'hole', id: focused.id, expected: 'NP' })
  })

  it('rejects wrappers that would change the surrounding slot color', () => {
    const example = exampleDocument()
    expect(() => wrapFocused(example, 'PredVP', 0)).toThrow(/does not match/)
    expect(() => wrapFocused(example, 'UseV', 0)).toThrow(/does not match/)
  })

  it('swaps a leaf only for an operation of the same color, keeping its identity', () => {
    const example = exampleDocument()
    const root = example.root
    if (root.kind !== 'apply') throw new Error('fixture')
    const tense = root.children[0]
    const past = swapLeaf(root, tense.id, 'Past')
    expect(toGfTerm(past)).toBe('MkS Past Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (DetCN Definite (UseN WomanN))))')
    expect(findNode(past, tense.id)).toMatchObject({ constructor: 'Past', output: 'Temp' })
    expect(() => swapLeaf(root, tense.id, 'Negative')).toThrow(/does not match/)
    expect(() => swapLeaf(root, root.id, 'Past')).toThrow(/leaf/)
  })

  it('serializes complete trees and refuses holes', () => {
    const example = exampleDocument()
    expect(isComplete(example.root)).toBe(true)
    expect(toGfTerm(example.root)).toBe('MkS Present Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (DetCN Definite (UseN WomanN))))')
    expect(() => toGfTerm(newDocument().root)).toThrow(/Incomplete S hole/)
  })

  it('validates the grammar fingerprint and heterogeneous child colors', () => {
    const example = exampleDocument()
    expect(validateDocument(example)).toBe(true)
    const corrupt = structuredClone(example)
    if (corrupt.root.kind === 'apply') corrupt.root.children.reverse()
    expect(validateDocument(corrupt)).toBe(false)
    expect(validateDocument({ ...example, grammar: { ...example.grammar, fingerprint: 'old' } })).toBe(false)
  })
})
