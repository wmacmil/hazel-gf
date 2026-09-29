import { describe, expect, it } from 'vitest'
import { linearizeInBrowser, loadBrowserGrammar } from './browser-gf'
import { fromGfTerm } from './editor'
import { LANGUAGE_IDS } from './languages'
import { grammarJson, oracleIndex, oracleShard } from './oracle.testkit'
import { distinguishing, parseSentence, terminalsOf } from './parsing'

const json = grammarJson()
const grammar = loadBrowserGrammar(json)
const terminals = Object.fromEntries(LANGUAGE_IDS.map(id => [id, terminalsOf(json, id)]))
const parse = (language: string, text: string) => parseSentence(grammar, language, text, terminals[language])

describe('parsing: text in an algebra back to trees of the operad', () => {
  it('round-trips: every sampled sentence parses back to the tree it came from', () => {
    // German parses cost ~350 ms each (GF's prediction over its large S), so sample it more sparsely.
    const stride: Record<string, number> = { HazelGFEng: 97, HazelGFSwe: 97, HazelGFGer: 1601 }
    for (const language of LANGUAGE_IDS) {
      let checked = 0
      for (const tense of oracleIndex.shards) {
        Object.keys(oracleShard(tense)).forEach((term, index) => {
          if (index % stride[language]) return
          const [linearization] = linearizeInBrowser(grammar, term, fromGfTerm(term), [language])
          const result = parse(language, linearization.text)
          expect(result.status, `${language}: ${linearization.text}`).toBe('parsed')
          if (result.status === 'parsed') expect(result.terms, linearization.text).toContain(term)
          checked++
        })
      }
      expect(checked).toBeGreaterThan(language === 'HazelGFGer' ? 15 : 300)
    }
  }, 300_000)

  it('keeps genuine ambiguity and drops editor placeholders', () => {
    const result = parse('HazelGFEng', 'I see the woman with the dog')
    expect(result.status === 'parsed' && result.terms.map(term => term.includes('AdvCN') ? 'noun' : 'verb').sort()).toEqual(['noun', 'verb'])
    expect(result.status === 'parsed' && result.terms.some(term => term.includes('Hole'))).toBe(false)
    if (result.status === 'parsed') {
      expect(Object.values(distinguishing(result.terms)).map(names => names.join()).sort()).toEqual(['AdvCN', 'AdvVP'])
    }
  })

  it('repairs capitalization the grammar requires', () => {
    expect(parse('HazelGFGer', 'der mann schläft')).toMatchObject({ status: 'parsed', read: ['der', 'Mann', 'schläft'] })
    expect(parse('HazelGFEng', 'The man sleeps.')).toMatchObject({ status: 'parsed', read: ['the', 'man', 'sleeps'] })
  })

  it('marks a failure: where it stopped, unknown words, and what would continue', () => {
    expect(parse('HazelGFEng', 'the zebra sleeps')).toMatchObject({ status: 'failed', consumed: 1, unknown: ['zebra'] })
    // "the man has" is a fine prefix (the man has slept); GF's English never says "has not".
    const contracted = parse('HazelGFEng', 'the man has not slept')
    expect(contracted).toMatchObject({ status: 'failed', consumed: 3 })
    expect(contracted.status === 'failed' && contracted.expected).toContain('slept')
    expect(contracted.status === 'failed' && contracted.expected.some(word => word.includes('⟦'))).toBe(false)
    const incomplete = parse('HazelGFGer', 'der Mann')
    expect(incomplete).toMatchObject({ status: 'failed', consumed: 2 })
    expect(incomplete.status === 'failed' && incomplete.expected).toContain('schläft')
  })
})
