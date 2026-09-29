import { describe, expect, it } from 'vitest'
import { allowedTenses, togglePins } from './constraints'

describe('pinning morphemes constrains the Temp leaf', () => {
  it('keeps only tenses that realize every pinned feature', () => {
    expect(allowedTenses(['PAST']).map(tense => tense.id)).toEqual(['Past', 'PastPerfect'])
    expect(allowedTenses(['PTCP']).map(tense => tense.id)).toEqual(['PresentPerfect', 'PastPerfect', 'FuturePerfect', 'ConditionalPerfect'])
    expect(allowedTenses(['FUT', 'PERF']).map(tense => tense.id)).toEqual(['FuturePerfect'])
    expect(allowedTenses([])).toHaveLength(8)
  })

  it('toggles only tense/aspect features, ignoring agreement and definiteness', () => {
    expect(togglePins([], ['PAST', '3SG'])).toEqual(['PAST'])
    expect(togglePins(['PAST'], ['PAST'])).toEqual([])
    expect(togglePins(['PAST'], ['DEF'])).toEqual(['PAST'])
  })
})
