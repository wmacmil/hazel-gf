import { producers } from './grammar'
import { FEATURE_AXES } from './morphology'
import { TENSES } from './projection'
import type { Constructor } from './model'

/** Only tense/aspect exponents constrain the tree today: they pin the Temp leaf. */
export const pinnable = (features: string[]) =>
  features.filter(feature => FEATURE_AXES[feature] === 'tense' || FEATURE_AXES[feature] === 'aspect')

/** The features a Temp leaf can realize on the surface. */
export function tenseFeatures(tense: string): string[] {
  const entry = TENSES[tense]
  return entry ? [entry.label, ...(entry.perfect ? ['PERF', 'PTCP'] : [])] : []
}

/** Temp leaves consistent with every pinned feature. */
export function allowedTenses(pinned: string[]): Constructor[] {
  return producers('Temp').filter(tense => pinned.every(feature => tenseFeatures(tense.id).includes(feature)))
}

/** Clicking a morpheme toggles its tense/aspect features as pins. */
export function togglePins(pinned: string[], features: string[]): string[] {
  const candidates = pinnable(features)
  if (!candidates.length) return pinned
  return candidates.every(feature => pinned.includes(feature))
    ? pinned.filter(feature => !candidates.includes(feature))
    : [...new Set([...pinned, ...candidates])]
}
