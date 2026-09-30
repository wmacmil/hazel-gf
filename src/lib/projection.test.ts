import { LANGUAGE_IDS } from './languages'
import { describe, expect, it } from 'vitest'
import { agreementExample, exampleDocument } from './examples'
import { findNode, preorder } from './editor'
import { normalizeLinearizations, partialProjections, type RawBracket } from './projection'
import { paradigms } from './oracle.testkit'



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
    expect(projections).toHaveLength(LANGUAGE_IDS.length)
    expect(projections.every(item => item.segments.some(segment => segment.text === '⟦CN⟧' && segment.role === 'hole'))).toBe(true)
  })

  it('splits Swedish suffixed definiteness into a morpheme that also realizes the Det node', () => {
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
    const [projection] = normalizeLinearizations(raw, document.root, 3, paradigms)
    const definite = preorder(document.root).find(node => node.kind === 'apply' && node.constructor === 'Definite')!
    const woman = preorder(document.root).find(node => node.kind === 'apply' && node.constructor === 'WomanN')!
    const noun = projection.segments.find(segment => segment.text === 'kvinnan')!
    expect(noun.morphemes?.map(piece => piece.text)).toEqual(['kvinna', 'n'])
    expect(noun.morphemes?.[1]).toMatchObject({ role: 'affix', features: ['DEF'], realizedBy: [woman.id, definite.id] })
    expect(projection.nodeYields[definite.id]).toContain(noun.id)
  })

  it('shows Swedish person agreement as an empty exponent inside the finite verb, linked to the subject', () => {
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
    const [projection] = normalizeLinearizations(raw, document.root, 4, paradigms)
    const man = preorder(document.root).find(node => node.kind === 'apply' && node.constructor === 'ManN')!
    const verb = projection.segments.find(segment => segment.text === 'sover')!
    expect(projection.segments.map(segment => segment.text)).toEqual(['mannen', 'sover', 'inte'])
    expect(verb.morphemes?.map(piece => `${piece.text}:${piece.features.join('·')}`)).toEqual(['sov:', 'er:PRES', '∅:3SG'])
    expect(verb.morphemes?.[2].realizedBy).toContain(man.id)
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
