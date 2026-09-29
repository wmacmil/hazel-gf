import { CATEGORY_COLORS, type CategoryId } from './model'
import { FEATURE_AXES } from './morphology'
import { FEATURE_COLORS, hueOf } from './style'

/**
 * Two colour theories over the same two projections (the abstract operad and
 * the concrete sentences), chosen by the `colors` setting:
 *
 * - `channels`: the channel is the hue. Sorts take the cool half of the wheel
 *   (operad), feature axes the warm half (algebra), so the two can never be
 *   confused (June coloring-demo doctrine; checked in style.test.ts).
 * - `pos`: the part of speech is the hue, and the *shade* is the channel —
 *   deep for the abstract operad, light for the concrete text. A noun is the
 *   same hue in the tree and in the sentence; only its lightness says which
 *   projection you are looking at. Family hues are user-editable.
 */
export type ColorTheory = 'channels' | 'pos'

export const POS_FAMILIES = {
  noun: { label: 'noun', sorts: ['N', 'CN', 'NP'], hue: 212 },
  pronoun: { label: 'pronoun', sorts: ['Pron'], hue: 262 },
  determiner: { label: 'determiner', sorts: ['Det'], hue: 48 },
  verb: { label: 'verb', sorts: ['V', 'V2', 'VP'], hue: 138 },
  adposition: { label: 'adposition', sorts: ['Prep', 'Adv'], hue: 176 },
  clause: { label: 'clause', sorts: ['S', 'Cl'], hue: 300 },
  functional: { label: 'tense · polarity', sorts: ['Temp', 'Pol'], hue: 20 },
} as const satisfies Record<string, { label: string; sorts: readonly CategoryId[]; hue: number }>
export type PosFamily = keyof typeof POS_FAMILIES

export const familyOf = (category: CategoryId): PosFamily =>
  (Object.keys(POS_FAMILIES) as PosFamily[]).find(family => (POS_FAMILIES[family].sorts as readonly string[]).includes(category)) ?? 'clause'

const defaultHues = () => Object.fromEntries(Object.entries(POS_FAMILIES).map(([family, spec]) => [family, spec.hue])) as Record<PosFamily, number>

/** The live palette: which theory, and (for `pos`) each family's hue. Persisted by App. */
export const palette = $state<{ theory: ColorTheory; hues: Record<PosFamily, number> }>({ theory: 'channels', hues: defaultHues() })

export const resetHues = () => { palette.hues = defaultHues() }

const hsl = (hue: number, saturation: number, lightness: number) => `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`

/** The two shades one hue takes. Abstract: deep fill + bright accent (on the dark operad). Concrete: light wash + dark ink (on paper). */
export function shades(hue: number) {
  return {
    abstract: { fill: hsl(hue, 45, 20), accent: hsl(hue, 75, 68) },
    concrete: { wash: hsl(hue, 80, 91), ink: hsl(hue, 60, 30), strong: hsl(hue, 70, 80) },
  }
}

/** A sort's colours in both projections, under the active theory. */
export function sortColor(category: CategoryId): ReturnType<typeof shades> {
  if (palette.theory === 'pos') return shades(palette.hues[familyOf(category)])
  const channel = CATEGORY_COLORS[category]
  return {
    abstract: { fill: '#131c2a', accent: channel.glow },
    concrete: { wash: channel.wash, ink: channel.ink, strong: channel.wash },
  }
}

/**
 * A morpheme's style. `channels`: a pure function of its fiber (one feature
 * axis → pure, several → blend, none → plain). `pos`: the light shade of the
 * word's part of speech, deeper on exponents, so the whole word reads as its POS.
 */
export function morphemeStyle(features: string[], wordCategory?: CategoryId, role?: string): string {
  if (palette.theory === 'pos') {
    if (!wordCategory) return ''
    const { concrete } = shades(palette.hues[familyOf(wordCategory)])
    const exponent = role === 'affix' || role === 'zero' || role === 'changed-stem'
    return `--m-ink:${concrete.ink};--m-wash:${exponent ? concrete.strong : concrete.wash}`
  }
  const axes = [...new Set(features.map(feature => FEATURE_AXES[feature]).filter(Boolean))]
  const colors = axes.map(axis => FEATURE_COLORS[axis])
  if (!colors.length) return ''
  if (colors.length === 1) return `--m-ink:${colors[0].ink};--m-wash:${colors[0].wash}`
  return `--m-ink:${colors[0].ink};--m-wash:linear-gradient(100deg, ${colors.map(color => color.wash).join(', ')})`
}

/** Pick a family's hue from any colour (the colour input gives hex). */
export const setFamilyColor = (family: PosFamily, hex: string) => { palette.hues = { ...palette.hues, [family]: Math.round(hueOf(hex)) } }

/** hsl hue → hex, for the colour inputs. */
export function hueToHex(hue: number): string {
  const s = 0.6, l = 0.45
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
