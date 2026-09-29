import { describe, expect, it } from 'vitest'
import { clearFocused, findNode, insertAt, newDocument, outputOf, preorder, toGfTerm } from './editor'
import type { ApplyNode } from './model'
import { LANGUAGES } from './languages'
import { paradigms } from './oracle.testkit'
import { candidates, formIndex } from './writing'
import { exampleDocument } from './examples'

const index = (id: string) => formIndex(paradigms, id)

describe('writing a word into a typed hole', () => {
  it('resolves every paradigm form back to its leaf, in every language', () => {
    for (const profile of LANGUAGES) {
      const forms = index(profile.id)
      for (const [leaf, cells] of Object.entries(paradigms.tables[profile.id])) {
        for (const form of Object.values(cells).filter(Boolean)) {
          expect(forms.get(form.toLocaleLowerCase())?.some(entry => entry.leaf === leaf), `${profile.id} ${form}`).toBe(true)
        }
      }
    }
  })

  it('offers only candidates of the hole’s sort', () => {
    for (const [sort, text] of [['NP', 'f'], ['VP', 's'], ['Adv', 'mit'], ['N', 'ha'], ['S', 'schl']] as const) {
      for (const candidate of candidates(index('HazelGFGer'), sort, text)) expect(outputOf(candidate.subtree)).toBe(sort)
    }
  })

  it('writes Frau into an NP hole, leaving a Det obligation', () => {
    const [frau] = candidates(index('HazelGFGer'), 'NP', 'Frau')
    expect(frau.leaf).toBe('WomanN')
    expect(frau.path).toEqual(['DetCN', 'UseN', 'WomanN'])
    const holes = preorder(frau.subtree).filter(node => node.kind === 'hole')
    expect(holes.map(node => outputOf(node))).toEqual(['Det'])
  })

  it('pins what an inflected form commits to, and nothing when the cells disagree', () => {
    const [schlief] = candidates(index('HazelGFGer'), 'V', 'schlief')
    expect(schlief).toMatchObject({ leaf: 'SleepV', pins: ['PAST'] })
    expect(candidates(index('HazelGFGer'), 'V', 'geschlafen')[0].pins).toEqual(['PTCP'])
    expect(candidates(index('HazelGFSwe'), 'V', 'sovit')[0].pins).toEqual(['PTCP'])
    // Syncretism: GF's own cells disagree, so the form commits to nothing.
    expect(candidates(index('HazelGFSwe'), 'V', 'sov')[0].pins).toEqual([]) // preterite or imperative
    expect(candidates(index('HazelGFEng'), 'V', 'slept')[0].pins).toEqual([]) // past or participle
  })

  it('reaches prepositions and polarity through their written words', () => {
    expect(candidates(index('HazelGFGer'), 'Adv', 'mit')[0].path).toEqual(['PrepNP', 'WithPrep'])
    expect(candidates(index('HazelGFSwe'), 'Pol', 'inte')[0].leaf).toBe('Negative')
  })

  it('finds nothing for a word outside the lexicon', () => {
    expect(candidates(index('HazelGFEng'), 'NP', 'zebra')).toEqual([])
  })

  it('inserts a candidate into a hole, typed, and focuses its first obligation', () => {
    const document = exampleDocument()
    const clause = (document.root as ApplyNode).children[2] as ApplyNode
    const subject = clause.children[0]
    const cleared = clearFocused({ ...document, focus: subject.id })
    const [woman] = candidates(index('HazelGFEng'), 'NP', 'woman')
    const written = insertAt(cleared, subject.id, woman.subtree)
    expect(findNode(written.root, written.focus)).toMatchObject({ kind: 'hole', expected: 'Det' })
    const [sleeps] = candidates(index('HazelGFEng'), 'VP', 'sleeps')
    expect(() => insertAt(cleared, subject.id, sleeps.subtree)).toThrow(/does not match/)
    expect(() => insertAt(document, subject.id, woman.subtree)).toThrow(/Only a hole/)
  })

  it('writes a whole sentence skeleton from a blank document', () => {
    const blank = newDocument()
    const [sleeps] = candidates(index('HazelGFEng'), 'S', 'sleeps')
    const written = insertAt(blank, blank.root.id, sleeps.subtree)
    expect(sleeps.path.at(-1)).toBe('SleepV')
    expect(findNode(written.root, written.focus)?.kind).toBe('hole')
    expect(() => toGfTerm(written.root)).toThrow(/hole/)
  })
})
