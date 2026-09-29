import { describe, expect, it } from 'vitest'
import { linearizeInBrowser, loadBrowserGrammar } from '../browser-gf'
import { fromGfTerm, preorder, toGfTerm } from '../editor'
import { agreementExample } from '../examples'
import { LANGUAGE_IDS } from '../languages'
import { grammarJson, paradigms } from '../oracle.testkit'
import { normalizeLinearizations } from '../projection'
import type { ApplyNode, Node } from '../model'
import { PROFILES, keySpecOf, resolveKey, validateProfile } from './commands'
import { DEFAULT_CAMERA, cameraGoalForNode, cameraTarget, resolveNavigation, type Direction, type GraphGeometry, type GraphNavigationConfig } from './graph-theory'
import { boxGeometry, flowGeometry, stepWord, structureOf } from './projections'

const HYBRID: GraphNavigationConfig = { strategy: 'hybrid-tree-v1', spatialAlgorithm: 'css-nav-grid-v1', boundary: 'stop', structuralSequence: 'siblings' }
const grammar = loadBrowserGrammar(grammarJson())
const byName = (root: Node, name: string) => preorder(root).find(node => node.kind === 'apply' && node.constructor === name)!.id
const nameOf = (root: Node, id: string | null | undefined) => (preorder(root).find(node => node.id === id) as ApplyNode | undefined)?.constructor

function sentence(term: string) {
  const root = fromGfTerm(term)
  const projections = normalizeLinearizations(linearizeInBrowser(grammar, term, root, LANGUAGE_IDS), root, 1, paradigms)
  return { root, projections }
}

const BOXES: GraphNavigationConfig = { ...HYBRID, halfPlane: 'edge' }
function move(root: Node, geometry: GraphGeometry, from: string, direction: Direction, config = HYBRID) {
  return nameOf(root, resolveNavigation({ focusedId: byName(root, from), structure: structureOf(root), geometry, orientation: 'top-to-bottom' },
    { kind: 'direction', direction }, config)?.targetId)
}

describe('hjkl in the SvelteFlow tree (hybrid: structural up/down, spatial left/right)', () => {
  const { root } = sentence(toGfTerm(agreementExample().root))
  const geometry = flowGeometry(root)
  it('goes down to the first child and up to the parent', () => {
    expect(move(root, geometry, 'MkS', 'south')).toBe('Present')
    expect(move(root, geometry, 'PredVP', 'south')).toBe('DetCN')
    expect(move(root, geometry, 'DetCN', 'north')).toBe('PredVP')
  })
  it('goes sideways to the visually nearest node', () => {
    expect(move(root, geometry, 'Present', 'east')).toBe('Negative')
    expect(move(root, geometry, 'DetCN', 'east')).toBe('UseV')
    expect(move(root, geometry, 'UseV', 'west')).toBe('DetCN')
  })
  it('only ever lands in the requested half-plane', () => {
    const structure = structureOf(root)
    for (const id of structure.focusable) for (const direction of ['west', 'east'] as Direction[]) {
      const decision = resolveNavigation({ focusedId: id, structure, geometry, orientation: 'top-to-bottom' }, { kind: 'direction', direction }, HYBRID)
      if (!decision) continue
      const a = geometry.rects.get(id)!, b = geometry.rects.get(decision.targetId)!
      expect(direction === 'east' ? b.x > a.x : b.x < a.x).toBe(true)
    }
  })
})

describe('hjkl in the phrase boxes under the sentence', () => {
  const term = 'MkS PresentPerfect Negative (PredVP (DetCN Definite (UseN ManN)) (AdvVP (UseV SleepV) (PrepNP WithPrep (DetCN Definite (UseN DogN)))))'
  const { root, projections } = sentence(term)
  const german = boxGeometry(root, projections[1])
  it('moves up to the enclosing box and down into it', () => {
    expect(move(root, german, 'ManN', 'north')).toBe('UseN')
    expect(move(root, german, 'AdvVP', 'south')).toBe('UseV')
  })
  it('moves sideways to the next constituent, not down into a child (edge half-plane)', () => {
    expect(move(root, german, 'DetCN', 'east', BOXES)).toBe('AdvVP')      // der Mann → [mit dem Hund geschlafen]
    expect(move(root, german, 'DetCN', 'east')).toBe('UseN')              // centre rule: Mann's box is "to the right"
    expect(move(root, german, 'AdvVP', 'west', BOXES)).toBe('DetCN')
  })
})

describe('s/d: side to side along the sentence', () => {
  const { root, projections } = sentence(toGfTerm(agreementExample().root))
  const [english, german] = projections
  const land = (projection: typeof english, from: string, step: 'previous' | 'next') => nameOf(root, stepWord(root, projection, byName(root, from), step)?.nodeId)
  it('steps word by word, landing on each word’s leaf', () => {
    expect(land(english, 'Definite', 'next')).toBe('ManN')
    expect(land(german, 'ManN', 'next')).toBe('SleepV') // der Mann schläft nicht
    expect(land(german, 'SleepV', 'previous')).toBe('ManN')
  })
  it('lands an auxiliary on the leaf it realizes, not the clause it is attributed to', () => {
    expect(land(english, 'SleepV', 'previous')).toBe('Negative') // doesn't
  })
  it('keeps its own position while focus stays on the stop', () => {
    const first = stepWord(root, english, byName(root, 'SleepV'), 'previous')!
    const second = stepWord(root, english, first.nodeId, 'previous', first)!
    expect([first.index, second.index]).toEqual([2, 1])
    expect(nameOf(root, second.nodeId)).toBe('ManN')
  })
  it('from a phrase, starts at its first word', () => {
    expect(land(english, 'DetCN', 'next')).toBe('ManN')
  })
})

describe('camera goals', () => {
  it('zoom-centers with a floor but never zooms out an enlarged view', () => {
    const rect = { x: 100, y: 100, width: 188, height: 92 }
    const goal = cameraGoalForNode('n', DEFAULT_CAMERA)
    expect(cameraTarget(goal, { x: 0, y: 0, zoom: 0.4 }, { width: 800, height: 600 }, rect).zoom).toBe(1.05)
    expect(cameraTarget(goal, { x: 0, y: 0, zoom: 1.6 }, { width: 800, height: 600 }, rect).zoom).toBe(1.6)
  })
})

describe('key profile', () => {
  it('is well-formed and resolves the bifurcated bindings', () => {
    const profile = PROFILES.vim
    expect(validateProfile(profile)).toEqual([])
    expect(resolveKey(profile, 'tree', 'j')).toBe('nav.south')
    expect(resolveKey(profile, 'sentence', 'd')).toBe('word.next')
    expect(resolveKey(profile, 'tree', keySpecOf({ key: '˙', code: 'KeyH', altKey: true }))).toBe('nav.parent')
    expect(resolveKey(profile, 'sentence', 'x')).toBeNull()
  })
})
