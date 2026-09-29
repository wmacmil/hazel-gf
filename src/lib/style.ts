import { FEATURE_AXES, type FeatureAxis } from './morphology'

/**
 * Algebra colors: one hue per feature axis, all in the warm half of the wheel
 * (328°–56°), disjoint from the operad's sort hues in model.ts.
 */
export const FEATURE_COLORS: Record<FeatureAxis, { ink: string; wash: string }> = {
  tense: { ink: '#b65616', wash: '#fce1cf' }, // 24°
  aspect: { ink: '#a1700d', wash: '#fcefcf' }, // 42°
  definiteness: { ink: '#8e850b', wash: '#fcf9cf' }, // 56°
  polarity: { ink: '#b61621', wash: '#fccfd2' }, // 356°
  agreement: { ink: '#b6166b', wash: '#fccfe7' }, // 328°
}

/** A morpheme's color is a pure function of its fiber: one axis → pure, several → blend, none → ink. */
export function morphemeStyle(features: string[]): string {
  const axes = [...new Set(features.map(feature => FEATURE_AXES[feature]).filter(Boolean))]
  const colors = axes.map(axis => FEATURE_COLORS[axis])
  if (!colors.length) return ''
  if (colors.length === 1) return `--m-ink:${colors[0].ink};--m-wash:${colors[0].wash}`
  return `--m-ink:${colors[0].ink};--m-wash:linear-gradient(100deg, ${colors.map(color => color.wash).join(', ')})`
}

export function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
  if (!delta) return 0
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return (hue * 60 + 360) % 360
}
