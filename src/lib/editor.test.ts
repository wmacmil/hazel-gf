import { describe, expect, it } from 'vitest'
import {
  clearFocused, fillFocused, findNode, isComplete, newDocument, outputOf, toGfTerm,
  validateDocument, wrapFocused,
} from './editor'
import { exampleDocument } from './examples'

describe('typed structure editing', () => {
  it('fills a hole only with an operation producing its color', () => {
    const blank = newDocument()
    const sentence = fillFocused(blank, 'MkS')
    expect(outputOf(sentence.root)).toBe('S')
    expect(findNode(sentence.root, sentence.focus)?.kind).toBe('hole')
    expect(outputOf(findNode(sentence.root, sentence.focus)!)).toBe('Pol')
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

  it('serializes complete trees and refuses holes', () => {
    const example = exampleDocument()
    expect(isComplete(example.root)).toBe(true)
    expect(toGfTerm(example.root)).toBe('MkS Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (DetCN Definite (UseN WomanN))))')
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
