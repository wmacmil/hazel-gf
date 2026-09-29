import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromGfTerm, toGfTerm } from './editor'
import { constructorById } from './grammar'
import { normalizeLinearizations, type RawLinearization } from './projection'
import type { Paradigms } from './morphology'
import { LANGUAGES } from './languages'
import type { Morpheme, Node } from './model'

const staticDir = resolve(__dirname, '../../oracle')
const paradigmsFile = resolve(__dirname, '../../public/static/paradigms.json')
const cache = new Map<string, unknown>()
const read = <T>(name: string): T => {
  if (!cache.has(name)) cache.set(name, JSON.parse(readFileSync(resolve(staticDir, name), 'utf8')))
  return cache.get(name) as T
}
const paradigms = JSON.parse(readFileSync(paradigmsFile, 'utf8')) as Paradigms
const { shards } = read<{ shards: string[] }>('index.json')

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
      for (const projection of normalizeLinearizations(read<Record<string, RawLinearization[]>>(`linearizations-${tense}.json`)[toGfTerm(root)], root, 1, paradigms)) {
        lines.get(projection.language)!.push(`${name.padEnd(7)}${subject.padEnd(7)}${tense.padEnd(15)}${
          projection.segments.map(segment => (segment.morphemes ?? []).map(show).join('·')).join(' ')}`)
      }
    }
    for (const profile of LANGUAGES) {
      await expect(lines.get(profile.id)!.join('\n') + '\n').toMatchFileSnapshot(`./__golden__/morphology.${profile.code}.txt`)
    }
  })

  it('forgets back to the surface and cites GF paradigms, for every precomputed sentence', () => {
    let words = 0
    for (const tense of shards) {
      for (const [term, raw] of Object.entries(read<Record<string, RawLinearization[]>>(`linearizations-${tense}.json`))) {
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
              const forms = Object.values(paradigms[projection.language][origin.constructor] ?? {})
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
