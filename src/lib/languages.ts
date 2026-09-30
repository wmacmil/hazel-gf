import registry from '../../languages.json'

/**
 * A language is a declared profile, not a hardcode (as in the parent Hungarian
 * app's schema/languages.toml). Adding one means a grammar/HazelGF<X>.gf
 * concrete syntax, one entry in languages.json, and a reviewed golden; see
 * docs/adding-a-language.md.
 */
export type LanguageProfile = {
  /** The GF concrete syntax, e.g. HazelGFGer. */
  id: string
  /** ISO code, matching the parent app's registry. */
  code: string
  label: string
  /** Paradigm cells (from `l -table`) holding the citation form of verbs and nouns. */
  citation: { verb: string; noun: string; adjective: string }
  /** Regex source stripped from the verb citation to get its stem (German -en, Swedish -a). */
  infinitiveEnding: string
  /** The existential's dummy subject (there / es / det): part of the clause, not a verb. */
  expletive: string
  /** Regex source for words that realize negative polarity. */
  negation: string
  /** Regex source for negation fused into an auxiliary (English n't); such words stay auxiliaries. */
  fusedNegation?: string
  agreement: {
    /** How subject agreement shows on the finite element. */
    realization: 'fused-suffix' | 'personal-ending' | 'zero'
    /** Tense labels whose finite element marks agreement, or every tense. */
    markedIn: string[] | 'all'
  }
  /** Personal endings read off paradigm rows (German): row prefix per tense label, ending per person. */
  personalEndings?: { rows: Record<string, string>; endings: Record<string, string> }
  /** A participle circumfix split into two pieces (German ge-…-en). */
  circumfix?: { feature: string; prefix: string; suffixes: string[] }
  /** Definiteness realized as a noun suffix (Swedish kvinna·n) rather than a separate word. */
  suffixedDefiniteness?: boolean
  /** Citation words for the browser's preview of incomplete trees. */
  partialLexicon: Record<string, string>
  /** GF terms with their expected linearization, checked by the smoke test and languages.test.ts. */
  smoke: { term: string; text: string }[]
}

export const LANGUAGES = registry as LanguageProfile[]
export const LANGUAGE_IDS = LANGUAGES.map(profile => profile.id)

const byId = new Map(LANGUAGES.map(profile => [profile.id, profile]))

export function profileOf(id: string): LanguageProfile {
  const profile = byId.get(id)
  if (!profile) throw new Error(`No language profile for ${id}`)
  return profile
}

export const marksAgreement = (profile: LanguageProfile, tense: string | undefined) =>
  profile.agreement.markedIn === 'all' || !tense || profile.agreement.markedIn.includes(tense)
