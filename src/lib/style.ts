import { CATEGORY_COLORS, type CategoryId } from './model'

/** CSS custom properties for a segment: one category is a pure hue, several blend (a fused fiber). */
export function segmentStyle(categories: CategoryId[]): string {
  const colors = categories.map(category => CATEGORY_COLORS[category])
  if (!colors.length) return ''
  if (colors.length === 1) return `--seg-ink:${colors[0].ink};--seg-wash:${colors[0].wash}`
  return `--seg-ink:${colors[0].ink};--seg-wash:linear-gradient(110deg, ${colors.map(color => color.wash).join(', ')})`
}
