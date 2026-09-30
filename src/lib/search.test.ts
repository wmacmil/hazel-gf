import { describe, expect, it } from 'vitest'
import { outputOf, preorder } from './editor'
import { paradigms } from './oracle.testkit'
import { parseSignature, searchExpressions } from './search'

describe('type-directed search', () => {
  it('parses signature queries', () => {
    expect(parseSignature('NP -> VP')).toEqual({ inputs: ['NP'], output: 'VP' })
    expect(parseSignature('Conj, S, S → S')).toEqual({ inputs: ['Conj', 'S', 'S'], output: 'S' })
    expect(parseSignature(': AP')).toEqual({ inputs: [], output: 'AP' })
    expect(parseSignature('dog')).toBeUndefined()
    expect(parseSignature('Foo -> VP')).toBeUndefined()
  })

  it('every result fits the hole: its expression has the hole’s sort', () => {
    for (const [target, query] of [['NP', 'red'], ['S', 'exist'], ['VP', '-> VP'], ['CN', 'AP -> _'], ['NP', 'Frau'], ['Cl', 'NP -> Cl']] as const) {
      const results = searchExpressions(query, target, paradigms)
      expect(results.length, `${target} ${query}`).toBeGreaterThan(0)
      for (const result of results) expect(outputOf(result.expression)).toBe(target)
    }
  })

  it('reaches an operation deep below the hole, leaving obligations', () => {
    const [red] = searchExpressions('red', 'NP', paradigms)
    expect(red.path).toEqual(['DetCN', 'AdjCN', 'PositA', 'RedA'])
    expect(preorder(red.expression).filter(node => node.kind === 'hole').map(outputOf).sort()).toEqual(['CN', 'Det'])
  })

  it('finds operations by signature: what takes an AP?', () => {
    const operations = searchExpressions('AP -> _', undefined, paradigms).map(result => result.operation.id).sort()
    expect(operations).toEqual(['AdAP', 'AdjCN', 'UseAP'])
  })

  it('finds by name, and by a word in any language with its pins', () => {
    expect(searchExpressions('ExistNP', 'S', paradigms)[0].path).toEqual(['MkS', 'ExistNP'])
    const schlief = searchExpressions('schlief', 'VP', paradigms).find(result => result.matched === 'word')!
    expect(schlief.word).toMatchObject({ form: 'schlief', pins: ['PAST'] })
    expect(schlief.path).toEqual(['UseV', 'SleepV'])
  })
})
