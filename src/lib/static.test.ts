import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agreementExample, exampleDocument } from './examples'
import { toGfTerm } from './editor'
import { producers } from './grammar'
import { normalizeLinearizations, type RawLinearization } from './projection'
import type { CategoryId } from './model'

const table = JSON.parse(readFileSync(resolve(__dirname, '../../public/static/linearizations.json'), 'utf8')) as Record<string, RawLinearization[]>

/** Number of complete trees of a category, counted from the editor's own palette. */
function completeTrees(category: CategoryId): number {
  return producers(category).reduce(
    (total, constructor) => total + constructor.inputs.reduce((product, input) => product * completeTrees(input), 1), 0)
}

describe('precomputed static linearizations', () => {
  it('covers exactly the complete S trees the editor can build', () => {
    expect(Object.keys(table)).toHaveLength(completeTrees('S'))
  })

  it('serves the worked examples through the same provenance pipeline', () => {
    const agreement = agreementExample()
    const projections = normalizeLinearizations(table[toGfTerm(agreement.root)], agreement.root, 1)
    expect(projections.map(item => item.text)).toEqual(["the man doesn't sleep", 'der Mann schläft nicht', 'mannen sover inte'])
    expect(table[toGfTerm(exampleDocument().root)].map(item => item.text)).toEqual(['I see the woman', 'ich sehe die Frau', 'jag ser kvinnan'])
  })
})
