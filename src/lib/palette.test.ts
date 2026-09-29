import { afterEach, describe, expect, it } from 'vitest'
import { CATEGORIES, CATEGORY_COLORS } from './model'
import { POS_FAMILIES, familyOf, morphemeStyle, palette, resetHues, setFamilyColor, sortColor, type PosFamily } from './palette.svelte'

const parts = (color: string) => color.match(/hsl\((\d+) (\d+)% (\d+)%\)/)!.slice(1).map(Number)

afterEach(() => { palette.theory = 'channels'; resetHues() })

describe('two colour theories', () => {
  it('channels: the sort colours are the channel palette, unchanged', () => {
    palette.theory = 'channels'
    for (const category of CATEGORIES) expect(sortColor(category).abstract.accent).toBe(CATEGORY_COLORS[category].glow)
  })

  it('pos: every sort belongs to exactly one part-of-speech family', () => {
    for (const category of CATEGORIES) {
      const owners = Object.values(POS_FAMILIES).filter(family => (family.sorts as readonly string[]).includes(category))
      expect(owners, category).toHaveLength(1)
    }
    expect(new Set(Object.values(POS_FAMILIES).map(family => family.hue)).size).toBe(Object.keys(POS_FAMILIES).length)
  })

  it('pos: one hue per family in both projections; shade alone separates abstract (dark) from concrete (light)', () => {
    palette.theory = 'pos'
    for (const category of CATEGORIES) {
      const { abstract, concrete } = sortColor(category)
      const [fillHue, , fillLight] = parts(abstract.fill)
      const [washHue, , washLight] = parts(concrete.wash)
      expect(fillHue).toBe(washHue)
      expect(fillLight).toBeLessThan(35)
      expect(washLight).toBeGreaterThan(80)
    }
  })

  it('pos: a user hue moves both shades of that family, and nothing else', () => {
    palette.theory = 'pos'
    setFamilyColor('verb', '#ff0000')
    expect(parts(sortColor('VP').abstract.fill)[0]).toBe(0)
    expect(parts(sortColor('V').concrete.wash)[0]).toBe(0)
    expect(parts(sortColor('NP').abstract.fill)[0]).toBe(POS_FAMILIES.noun.hue)
  })

  it('pos: a word is coloured by its part of speech, deeper on its exponents', () => {
    palette.theory = 'pos'
    const stem = morphemeStyle([], 'V', 'stem'), affix = morphemeStyle(['PAST'], 'V', 'affix')
    expect(stem).toContain(`hsl(${POS_FAMILIES.verb.hue} `)
    expect(stem).not.toBe(affix)
    expect(familyOf('Pron' as never) satisfies PosFamily).toBe('pronoun')
  })
})
