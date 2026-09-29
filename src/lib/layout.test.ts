import { describe, expect, it } from 'vitest'
import { columnFit, fitScale, sentenceWidth } from './layout'
import type { LinearizationProjection } from './model'

const sentence = (...words: string[]): LinearizationProjection => ({
  language: 'x', text: words.join(' '), nodeYields: {}, revision: 0, source: 'gf',
  segments: words.map((text, index) => ({ id: `${index}`, text, role: 'overt', realizedBy: [], categories: [], featureValues: [] })),
})

describe('sentences are as wide as they are long', () => {
  it('grows with the words', () => {
    expect(sentenceWidth(sentence('the', 'man', 'sleeps'))).toBeLessThan(sentenceWidth(sentence('the', 'man', 'sleeps', 'in', 'the', 'house')))
  })

  it('puts short sentences in columns and stacks long ones, depending on the pane', () => {
    const short = [sentence('I', 'sleep'), sentence('ich', 'schlafe'), sentence('jag', 'sover')]
    const long = [sentence('the', 'man', "doesn't", 'sleep', 'in', 'the', 'house'), ...short.slice(1)]
    expect(columnFit(short, 700).fits).toBe(true)
    expect(columnFit(long, 500).fits).toBe(false)
    expect(columnFit(long, 1600).fits).toBe(true)
    expect(columnFit(short, 0).fits).toBe(false)
  })

  it('scales to fill the space without ever overflowing it', () => {
    const short = [sentence('I', 'sleep'), sentence('ich', 'schlafe'), sentence('jag', 'sover')]
    const { scale } = columnFit(short, 700)
    const total = short.reduce((sum, item) => sum + sentenceWidth(item), 0)
    expect(total * scale + 24 * 2).toBeLessThanOrEqual(700 + 0.5)
    expect(scale).toBeGreaterThan(1)
    expect(fitScale(800, 400)).toBe(0.55)           // floor: very long rows shrink, then scroll
    expect(fitScale(300, 330)).toBeCloseTo(1.1)
    expect(fitScale(300, 2000)).toBe(2)            // ceiling: short text grows, within reason
  })
})
