import { describe, expect, it } from 'vitest'
import { agreementExample, exampleDocument } from './examples'
import { findNode, preorder } from './editor'
import { normalizeLinearizations, partialProjections, type RawBracket } from './projection'

const bracket = (funName: string, cat: string, ...children: RawBracket[]): RawBracket =>
  ({ fun: funName, cat, fid: 0, index: 0, children })
const token = (value: string): RawBracket => ({ token: value })

describe('linearization provenance', () => {
  it('keeps typed holes visible in every partial projection', () => {
    const document = exampleDocument()
    const object = findNode(document.root, document.focus)!
    if (object.kind !== 'apply') throw new Error('fixture')
    object.children[1] = { kind: 'hole', id: 'missing-cn', expected: 'CN' }
    const projections = partialProjections(document.root, 7)
    expect(projections).toHaveLength(3)
    expect(projections.every(item => item.segments.some(segment => segment.text === '⟦CN⟧' && segment.role === 'hole'))).toBe(true)
  })

  it('splits Swedish suffixed definiteness into its realization fiber', () => {
    const document = exampleDocument()
    const raw = [{
      to: 'HazelGFSwe', text: 'jag ser kvinnan', brackets: [
        bracket('MkS', 'S',
          bracket('IPron', 'Pron', token('jag')),
          bracket('SeeV2', 'V2', token('ser')),
          bracket('WomanN', 'N', token('kvinnan')),
        ),
      ],
    }]
    const [projection] = normalizeLinearizations(raw, document.root, 3)
    const suffix = projection.segments.find(segment => segment.text === 'n' && segment.featureValues.includes('DEF'))
    const definite = preorder(document.root).find(node => node.kind === 'apply' && node.constructor === 'Definite')!
    const woman = preorder(document.root).find(node => node.kind === 'apply' && node.constructor === 'WomanN')!
    expect(projection.segments.map(segment => segment.text)).toEqual(['jag', 'ser', 'kvinna', 'n'])
    expect(suffix?.realizedBy).toEqual([woman.id, definite.id])
    expect(projection.nodeYields[definite.id]).toContain(suffix?.id)
  })

  it('shows Swedish person agreement as an empty exponent', () => {
    const document = agreementExample()
    const raw = [{
      to: 'HazelGFSwe', text: 'mannen sover inte', brackets: [
        bracket('MkS', 'S',
          bracket('Negative', 'Pol', token('inte')),
          bracket('ManN', 'N', token('mannen')),
          bracket('SleepV', 'V', token('sover')),
        ),
      ],
    }]
    const [projection] = normalizeLinearizations(raw, document.root, 4)
    expect(projection.segments.map(segment => segment.text)).toEqual(['man', 'nen', 'sover', '∅', 'inte'])
    expect(projection.segments).toContainEqual(expect.objectContaining({ role: 'zero', text: '∅', featureValues: ['3SG'] }))
    expect(projection.segments.find(segment => segment.text === 'sover')?.featureValues).toContain('PRES')
  })

  it('uses GF surface order and assigns English agreement to the negative auxiliary', () => {
    const document = agreementExample()
    const raw = [{
      to: 'HazelGFEng', text: "the man doesn't sleep", brackets: [
        bracket('MkS', 'S',
          bracket('PredVP', 'Cl', token("doesn't")),
          bracket('Definite', 'Det', token('the')),
          bracket('ManN', 'N', token('man')),
          bracket('SleepV', 'V', token('sleep')),
        ),
      ],
    }]
    const [projection] = normalizeLinearizations(raw, document.root, 5)
    expect(projection.segments.map(segment => segment.text)).toEqual(['the', 'man', "doesn't", 'sleep'])
    expect(projection.segments.find(segment => segment.text === "doesn't")?.featureValues).toEqual(['NEG', 'PRES', '3SG'])
    expect(projection.segments.find(segment => segment.text === 'sleep')?.featureValues).toEqual([])
  })
})
