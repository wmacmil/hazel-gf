import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { linearizeInBrowser, loadBrowserGrammar } from './browser-gf'
import { fromGfTerm } from './editor'
import { CONSTRUCTORS } from './grammar'
import { LANGUAGES } from './languages'
import type { Paradigms } from './morphology'

const app = resolve(__dirname, '../..')
const grammar = loadBrowserGrammar(JSON.parse(readFileSync(resolve(app, 'public/HazelGF.json'), 'utf8')))
const paradigms = JSON.parse(readFileSync(resolve(app, 'public/static/paradigms.json'), 'utf8')) as Paradigms
const LEXICAL = new Set(['N', 'V', 'V2'])

/** Everything a language must satisfy; see docs/adding-a-language.md. */
describe.each(LANGUAGES.map(profile => [profile.id, profile] as const))('language profile %s', (id, profile) => {
  it('is a concrete syntax of the compiled grammar', () => {
    expect(Object.keys(grammar.concretes)).toContain(id)
  })

  it('linearizes its smoke goldens in the browser runtime', () => {
    for (const { term, text } of profile.smoke) {
      const [linearization] = linearizeInBrowser(grammar, term, fromGfTerm(term), [id])
      expect(linearization.text).toBe(text)
    }
  })

  it('has well-formed patterns and citation cells for every lexical leaf', () => {
    for (const pattern of [profile.negation, profile.fusedNegation, profile.infinitiveEnding].filter(Boolean)) {
      expect(() => new RegExp(pattern!)).not.toThrow()
    }
    for (const constructor of CONSTRUCTORS.filter(item => LEXICAL.has(item.output))) {
      const cell = constructor.output === 'N' ? profile.citation.noun : profile.citation.verb
      expect(paradigms[id]?.[constructor.id]?.[cell], `${constructor.id} ${cell}`).toBeTruthy()
    }
  })

  it('previews every leaf of an incomplete tree', () => {
    for (const constructor of CONSTRUCTORS.filter(item => !item.inputs.length && item.output !== 'Temp')) {
      expect(profile.partialLexicon, constructor.id).toHaveProperty(constructor.id)
    }
  })
})
