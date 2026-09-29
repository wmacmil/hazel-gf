import type { LanguageId, Morpheme, NodeId } from './model'
import { profileOf } from './languages'

/** GF `l -table` output per language and lexical leaf: parameter cell → form. */
export type Paradigms = Record<LanguageId, Record<string, Record<string, string>>>

/** Which algebra axis a feature label belongs to; morpheme colors are per axis. */
export type FeatureAxis = 'tense' | 'aspect' | 'agreement' | 'polarity' | 'definiteness'

export const FEATURE_AXES: Record<string, FeatureAxis> = {
  PRES: 'tense', PAST: 'tense', FUT: 'tense', COND: 'tense',
  PERF: 'aspect', PTCP: 'aspect',
  '3SG': 'agreement',
  NEG: 'polarity',
  DEF: 'definiteness', INDEF: 'definiteness',
}

export type WordContext = {
  language: LanguageId
  /** The lexical leaf that produced the word, or undefined for function words (auxiliaries, negation). */
  lexeme?: { id: NodeId; constructor: string; category: string }
  text: string
  features: string[]
  /** Nodes that control each axis: Temp for tense/aspect, the subject head for agreement, Det for definiteness. */
  controllers: Partial<Record<FeatureAxis, NodeId>>
  /** Nodes GF attributed the whole word to. */
  realizedBy: NodeId[]
}

const commonPrefix = (words: string[]) => {
  let prefix = words[0] ?? ''
  for (const word of words) while (!word.startsWith(prefix)) prefix = prefix.slice(0, -1)
  return prefix
}

function stemOf(context: WordContext, paradigms: Paradigms): string | undefined {
  const { language, lexeme } = context
  const table = lexeme && paradigms[language]?.[lexeme.constructor]
  if (!table) return undefined
  const profile = profileOf(language)
  const isVerb = lexeme.category === 'V' || lexeme.category === 'V2'
  const citation = table[isVerb ? profile.citation.verb : profile.citation.noun]
  if (!citation) return undefined
  return isVerb && profile.infinitiveEnding ? citation.replace(new RegExp(profile.infinitiveEnding), '') : citation
}

/** Split an inflected word into stem + exponents and give each piece its features and provenance. */
export function segmentWord(context: WordContext, paradigms: Paradigms): Morpheme[] {
  const { language, lexeme, text, features, controllers, realizedBy } = context
  const profile = profileOf(language)
  const zeroAgreement = profile.agreement.realization === 'zero'
  const axis = (feature: string) => FEATURE_AXES[feature]
  const provenance = (pieceFeatures: string[]) => [...new Set([
    ...(lexeme ? [lexeme.id] : realizedBy),
    ...pieceFeatures.map(feature => controllers[axis(feature)]).filter((id): id is NodeId => Boolean(id)),
  ])]
  const piece = (pieceText: string, role: Morpheme['role'], pieceFeatures: string[] = []): Morpheme =>
    ({ text: pieceText, role, features: pieceFeatures, realizedBy: provenance(pieceFeatures) })
  const withZero = (pieces: Morpheme[], rest: string[]) =>
    rest.length ? [...pieces, piece('∅', 'zero', rest)] : pieces

  const agreement = features.filter(feature => axis(feature) === 'agreement')
  const tense = features.filter(feature => axis(feature) === 'tense')
  const aspect = features.filter(feature => axis(feature) === 'aspect')

  // Function words (auxiliaries, determiners, pronouns, negation) are one piece;
  // a language with zero agreement (Swedish) shows it as ∅ inside the finite word.
  const stem = stemOf(context, paradigms)
  if (!lexeme || !stem) {
    const overt = features.filter(feature => !(zeroAgreement && axis(feature) === 'agreement'))
    return withZero([{ ...piece(text, 'function', overt), realizedBy: provenance(overt).concat(realizedBy).filter((id, i, all) => all.indexOf(id) === i) }],
      zeroAgreement ? agreement : [])
  }
  if (!features.length) return [piece(text, 'stem')]

  // Participle circumfix (German ge·STEM·en / ge·STEM·t): both halves carry the feature.
  const circumfix = profile.circumfix
  const suffix = circumfix?.suffixes.find(ending => text.endsWith(ending))
  if (circumfix && suffix && aspect.includes(circumfix.feature) && text.startsWith(circumfix.prefix)
    && text.length > circumfix.prefix.length + suffix.length) {
    const middle = text.slice(circumfix.prefix.length, -suffix.length)
    return [piece(circumfix.prefix, 'affix', aspect), piece(middle, middle === stem ? 'stem' : 'changed-stem'), piece(suffix, 'affix', aspect)]
  }

  // Personal endings (German): read off the verb's own paradigm cell.
  let core = text
  let personal = ''
  const personalEndings = profile.personalEndings
  const rowPrefix = personalEndings && tense.length ? personalEndings.rows[tense[0]] : undefined
  if (personalEndings && rowPrefix) {
    const table = paradigms[language][lexeme.constructor]
    const row = Object.entries(table).filter(([cell]) => cell.startsWith(rowPrefix))
    const rowStem = commonPrefix(row.map(([, form]) => form))
    // Syncretic cells (liest = 2SG = 3SG) are resolved by the subject's agreement.
    const cells = row.filter(([, form]) => form === text).map(([name]) => name)
    const cell = (cells.find(name => agreement.includes('3SG') && name.includes('Sg P3')) ?? cells[0])?.match(/(Sg|Pl) (P[123])/)
    if (rowStem.length >= Math.min(stem.length, text.length) && text.startsWith(rowStem)) personal = text.slice(rowStem.length)
    else if (cell) personal = personalEndings.endings[`${cell[1]} ${cell[2]}`] ?? ''
    if (!text.endsWith(personal) || personal === text) personal = ''
    core = text.slice(0, text.length - personal.length)
  }

  const inflection = [...tense, ...aspect]
  const pieces: Morpheme[] = []
  let marked = false
  if (core.startsWith(stem)) {
    pieces.push(piece(stem, 'stem'))
    const marker = core.slice(stem.length)
    if (marker) {
      // A tense marker (lieb·te, walk·ed, sov·er). A fused-suffix language
      // puts agreement into it too (English sleep·s = PRES·3SG).
      const fused = profile.agreement.realization === 'fused-suffix' ? agreement : []
      pieces.push(piece(marker, 'affix', [...inflection, ...fused, ...features.filter(f => axis(f) === 'definiteness')]))
      marked = true
    }
  } else {
    // Ablaut or suppletion (schlief, sah, saw, gick) carries past/participle;
    // present-tense umlaut (schläf-, sieh-) is stem alternation, not a tense marker.
    const carriesTense = inflection.some(feature => feature !== 'PRES')
    pieces.push(piece(core, 'changed-stem', carriesTense ? inflection : []))
    marked = carriesTense
  }

  switch (profile.agreement.realization) {
    case 'personal-ending':
      if (personal) return [...pieces, piece(personal, 'affix', marked ? agreement : [...inflection, ...agreement])]
      return withZero(marked ? pieces : withZero(pieces, inflection), agreement)
    case 'fused-suffix':
      return marked ? pieces : withZero(pieces, [...inflection, ...agreement])
    case 'zero':
      return withZero(marked ? pieces : withZero(pieces, inflection), agreement)
  }
}
