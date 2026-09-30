import { describe, expect, it } from 'vitest'
import { fromGfTerm, toGfTerm } from './editor'
import { constructorById } from './grammar'
import { normalizeLinearizations } from './projection'
import { grammarJson, oracleIndex, oracleShard, paradigms } from './oracle.testkit'
import { linearizeInBrowser, loadBrowserGrammar } from './browser-gf'

const grammar = loadBrowserGrammar(grammarJson())
import { LANGUAGES } from './languages'
import type { Morpheme, Node } from './model'

let serial = 0
const apply = (constructor: string, ...children: Node[]): Node =>
  ({ kind: 'apply', id: `t${serial++}`, constructor, output: constructorById.get(constructor)!.output, children })

const show = (morpheme: Morpheme) => morpheme.role === 'zero'
  ? `∅[${morpheme.features.join('·')}]`
  : `${morpheme.role === 'changed-stem' ? '~' : ''}${morpheme.text}${morpheme.features.length ? `[${morpheme.features.join('·')}]` : ''}`

describe('morpheme sub-boxes from GF paradigm tables', () => {
  it('segments every verb of the lexicon as reviewed (one golden file per language)', async () => {
    const verbs: Record<string, () => Node> = {
      SleepV: () => apply('UseV', apply('SleepV')), WalkV: () => apply('UseV', apply('WalkV')), RunV: () => apply('UseV', apply('RunV')),
      SeeV2: () => apply('ComplV2', apply('SeeV2'), apply('UsePron', apply('ShePron'))),
      LoveV2: () => apply('ComplV2', apply('LoveV2'), apply('UsePron', apply('ShePron'))),
      ReadV2: () => apply('ComplV2', apply('ReadV2'), apply('DetCN', apply('Definite'), apply('UseN', apply('BookN')))),
    }
    const lines = new Map(LANGUAGES.map(profile => [profile.id, [] as string[]]))
    for (const [name, vp] of Object.entries(verbs)) for (const subject of ['HePron', 'IPron']) for (const tense of ['Present', 'Past', 'PresentPerfect']) {
      const root = apply('MkS', apply(tense), apply('Positive'), apply('PredVP', apply('UsePron', apply(subject)), vp()))
      for (const projection of normalizeLinearizations(oracleShard(tense)[toGfTerm(root)], root, 1, paradigms)) {
        lines.get(projection.language)!.push(`${name.padEnd(7)}${subject.padEnd(7)}${tense.padEnd(15)}${
          projection.segments.map(segment => (segment.morphemes ?? []).map(show).join('·')).join(' ')}`)
      }
    }
    for (const profile of LANGUAGES) {
      await expect(lines.get(profile.id)!.join('\n') + '\n').toMatchFileSnapshot(`./__golden__/morphology.${profile.code}.txt`)
    }
  })

  it('segments prepositional phrases as reviewed (one golden file per language)', async () => {
    const objects = ['DetCN Definite (UseN TableN)', 'DetCN Definite (UseN CityN)', 'DetCN Indefinite (UseN GardenN)', 'UsePron HePron', 'UsePron TheyPron']
    const lines = new Map(LANGUAGES.map(profile => [profile.id, [] as string[]]))
    for (const [tense, clause] of [['Present', 'PredVP (UsePron IPron) (AdvVP (UseV SleepV)'], ['PresentPerfect', 'PredVP (DetCN Definite (UseN ManN)) (AdvVP (UseV WalkV)']]) {
      for (const prep of ['InPrep', 'OnPrep', 'WithPrep', 'ToPrep', 'UnderPrep']) for (const object of objects) {
        const term = `MkS ${tense} Positive (${clause} (PrepNP ${prep} (${object}))))`
        const root = fromGfTerm(term)
        for (const projection of normalizeLinearizations(oracleShard(tense)[term], root, 1, paradigms)) {
          lines.get(projection.language)!.push(`${prep.padEnd(10)}${tense.padEnd(15)}${
            projection.segments.map(segment => (segment.morphemes ?? []).map(show).join('·')).join(' ')}`)
        }
      }
    }
    for (const profile of LANGUAGES) {
      await expect(lines.get(profile.id)!.join('\n') + '\n').toMatchFileSnapshot(`./__golden__/prepositions.${profile.code}.txt`)
    }
  })

  it('segments the wider grammar as reviewed: adjectives, quantifiers, existentials, coordination', async () => {
    const terms = [
      'MkS Present Positive (PredVP (DetCN Definite (AdjCN (PositA BigA) (UseN DogN))) (UseV SleepV))',
      'MkS Present Positive (PredVP (DetCN Indefinite (AdjCN (PositA OldA) (UseN WomanN))) (UseV SleepV))',
      'MkS Past Positive (PredVP (DetCN EveryDet (AdjCN (PositA SmallA) (UseN ChildN))) (UseV SleepV))',
      'MkS Present Negative (PredVP (DetCN SomeDet (AdjCN (PositA GoodA) (UseN HouseN))) (UseV SleepV))',
      'MkS Present Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (DetCN Indefinite (AdjCN (PositA RedA) (UseN CarN)))))',
      'MkS Present Positive (PredVP (DetCN Definite (AdjCN (AdAP VeryAdA (PositA HappyA)) (UseN ManN))) (UseV SleepV))',
      'MkS Past Positive (PredVP (DetCN Definite (UseN ChildN)) (UseAP (PositA HappyA)))',
      'MkS PresentPerfect Negative (PredVP (UsePron WePron) (UseAP (PositA OldA)))',
      'MkS Present Positive (ExistNP (DetCN Indefinite (UseN BirdN)))',
      'MkS PresentPerfect Negative (ExistNP (DetCN Indefinite (AdjCN (PositA RedA) (UseN CarN))))',
      'MkS Present Positive (PredVP (DetCN EveryDet (UseN TeacherN)) (ComplV2 HelpV2 (DetCN Definite (UseN ChildN))))',
      'MkS Present Positive (PredVP (UsePron HePron) (AdvVP (UseV WalkV) TodayAdv))',
      'MkS Present Positive (PredVP (ConjNP AndConj (DetCN Definite (UseN ManN)) (DetCN Definite (UseN WomanN))) (UseV SwimV))',
      'MkS Present Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (ConjNP OrConj (UsePron HePron) (DetCN Definite (UseN DogN)))))',
      'ConjS AndConj (MkS Present Positive (PredVP (UsePron HePron) (UseV SleepV))) (MkS Past Negative (PredVP (DetCN EveryDet (UseN WomanN)) (UseV RunV)))',
    ]
    const lines = new Map(LANGUAGES.map(profile => [profile.id, [] as string[]]))
    for (const term of terms) {
      // The browser runtime is conformance-tested against the server, so any term can be used here.
      const root = fromGfTerm(term)
      const raw = linearizeInBrowser(grammar, term, root, LANGUAGES.map(profile => profile.id))
      for (const projection of normalizeLinearizations(raw, root, 1, paradigms)) {
        lines.get(projection.language)!.push(projection.segments.map(segment => (segment.morphemes ?? []).map(show).join('·')).join(' '))
      }
    }
    for (const profile of LANGUAGES) {
      await expect(lines.get(profile.id)!.join('\n') + '\n').toMatchFileSnapshot(`./__golden__/constructions.${profile.code}.txt`)
    }
  })

  it('forgets back to the surface and cites GF paradigms, for every precomputed sentence', () => {
    let words = 0
    for (const tense of oracleIndex.shards) {
      for (const [term, raw] of Object.entries(oracleShard(tense))) {
        const root = fromGfTerm(term)
        const nodes = new Map<string, Node>()
        const visit = (node: Node) => { nodes.set(node.id, node); if (node.kind === 'apply') node.children.forEach(visit) }
        visit(root)
        for (const projection of normalizeLinearizations(raw, root, 1, paradigms)) {
          for (const segment of projection.segments) {
            const pieces = segment.morphemes ?? []
            expect(pieces.filter(piece => piece.role !== 'zero').map(piece => piece.text).join('')).toBe(segment.text)
            const origin = nodes.get(segment.realizedBy[0])
            if (origin?.kind === 'apply' && !origin.children.length && pieces.some(piece => piece.role === 'affix' || piece.role === 'changed-stem')) {
              const forms = Object.values(paradigms.tables[projection.language][origin.constructor] ?? {})
              expect(forms.map(form => form.toLowerCase())).toContain(segment.text.toLowerCase())
            }
            words++
          }
        }
      }
    }
    expect(words).toBeGreaterThan(100000)
  }, 60_000)
})
