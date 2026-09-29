import type { LinearizationProjection } from './model'

/** Rendered width of a sentence in px at scale 1, estimated from its morpheme boxes. */
export function sentenceWidth(projection: LinearizationProjection): number {
  // Calibrated against the rendered page (Georgia 17px), rounded up 5% for safety.
  const GAP = 6.4
  const words = projection.segments.map(segment => {
    const pieces = segment.morphemes ?? [{ text: segment.text, features: segment.featureValues }]
    return pieces.reduce((sum, piece) => sum + Math.max(piece.text.length * 9.4, piece.features.join('·').length * 4.6) + 9, 6)
  })
  return 1.05 * (words.reduce((total, word) => total + word, 0) + GAP * Math.max(0, words.length - 1))
}

export const SCALE = { min: 0.55, max: 2 }
const clamp = (value: number) => Math.min(SCALE.max, Math.max(SCALE.min, value))

/**
 * Languages side by side (l1 | l2 | l3), each column as wide as its sentence,
 * when all of them fit the pane together; the shared scale then grows them
 * to fill it. Otherwise one sentence per row, each scaled to its own width.
 */
export function columnFit(projections: LinearizationProjection[], paneWidth: number, gap = 24): { fits: boolean; scale: number } {
  if (!projections.length || paneWidth <= 0) return { fits: false, scale: 1 }
  const total = projections.reduce((sum, projection) => sum + sentenceWidth(projection), 0) + gap * (projections.length - 1)
  return total <= paneWidth ? { fits: true, scale: clamp((paneWidth - gap * (projections.length - 1)) / (total - gap * (projections.length - 1))) } : { fits: false, scale: 1 }
}

/** Scale that makes one sentence fill (but never overflow) the width available to it. */
export const fitScale = (natural: number, available: number) => natural > 0 && available > 0 ? clamp(available / natural) : 1
