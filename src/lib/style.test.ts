import { describe, expect, it } from 'vitest'
import { CATEGORY_COLORS } from './model'
import { FEATURE_COLORS, hueOf } from './style'

describe('channel-scoped color', () => {
  it('keeps operad sorts in the cool half and algebra features in the warm half', () => {
    for (const { ink, glow } of Object.values(CATEGORY_COLORS)) {
      for (const hex of [ink, glow]) expect(hueOf(hex)).toBeGreaterThanOrEqual(105), expect(hueOf(hex)).toBeLessThanOrEqual(295)
    }
    for (const { ink } of Object.values(FEATURE_COLORS)) {
      const hue = hueOf(ink)
      expect(hue >= 300 || hue <= 80).toBe(true)
    }
  })
})
