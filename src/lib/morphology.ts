import type { LanguageId, Morpheme, NodeId } from './model'

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

const CITATION: Record<LanguageId, { verb: string; noun: string; infinitive: RegExp }> = {
  HazelGFEng: { verb: 'VInf', noun: 'Sg Nom', infinitive: /$^/ },
  HazelGFGer: { verb: '(VInf False)', noun: 'Sg Nom', infinitive: /e?n$/ },
  HazelGFSwe: { verb: '(VI (VInfin Act))', noun: 'Sg Indef Nom', infinitive: /a$/ },
}

/** German finite rows, by the tense the finite verb carries. */
const GERMAN_ROW: Record<string, string> = { PRES: 'VPresInd', PAST: 'VImpfInd' }
const GERMAN_PERSONAL_ENDINGS: Record<string, string> = {
  'Sg P1': 'e', 'Sg P2': 'st', 'Sg P3': 't', 'Pl P1': 'en', 'Pl P2': 't', 'Pl P3': 'en',
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
  const isVerb = lexeme.category === 'V' || lexeme.category === 'V2'
  const citation = table[isVerb ? CITATION[language].verb : CITATION[language].noun]
  if (!citation) return undefined
  return isVerb ? citation.replace(CITATION[language].infinitive, '') : citation
}

/** Split an inflected word into stem + exponents and give each piece its features and provenance. */
export function segmentWord(context: WordContext, paradigms: Paradigms): Morpheme[] {
  const { language, lexeme, text, features, controllers, realizedBy } = context
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
  // Swedish shows its absent agreement as ∅ inside the finite word.
  const stem = stemOf(context, paradigms)
  if (!lexeme || !stem) {
    const overt = features.filter(feature => !(language === 'HazelGFSwe' && axis(feature) === 'agreement'))
    return withZero([{ ...piece(text, 'function', overt), realizedBy: provenance(overt).concat(realizedBy).filter((id, i, all) => all.indexOf(id) === i) }],
      language === 'HazelGFSwe' ? agreement : [])
  }
  if (!features.length) return [piece(text, 'stem')]

  // German participle circumfix: ge·STEM·en / ge·STEM·t, both halves PTCP.
  if (language === 'HazelGFGer' && aspect.includes('PTCP') && /^ge.+(en|t)$/.test(text)) {
    const suffix = text.endsWith('en') ? 'en' : 't'
    const middle = text.slice(2, -suffix.length)
    return [piece('ge', 'affix', aspect), piece(middle, middle === stem ? 'stem' : 'changed-stem'), piece(suffix, 'affix', aspect)]
  }

  // German finite verbs: the personal ending is read off the verb's own paradigm cell.
  let core = text
  let personal = ''
  if (language === 'HazelGFGer' && tense.length) {
    const table = paradigms[language][lexeme.constructor]
    const row = Object.entries(table).filter(([cell]) => cell.startsWith(`(VFin False (${GERMAN_ROW[tense[0]]} `))
    const rowStem = commonPrefix(row.map(([, form]) => form))
    // Syncretic cells (liest = 2SG = 3SG) are resolved by the subject's agreement.
    const cells = row.filter(([, form]) => form === text).map(([name]) => name)
    const cell = (cells.find(name => agreement.includes('3SG') && name.includes('Sg P3')) ?? cells[0])?.match(/(Sg|Pl) (P[123])/)
    if (rowStem.length >= Math.min(stem.length, text.length) && text.startsWith(rowStem)) personal = text.slice(rowStem.length)
    else if (cell) personal = GERMAN_PERSONAL_ENDINGS[`${cell[1]} ${cell[2]}`] ?? ''
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
      // A tense marker (lieb·te, walk·ed, sov·er). Where no separate personal
      // ending exists, English fuses agreement into it (sleep·s = PRES·3SG).
      const fused = language === 'HazelGFEng' ? agreement : []
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

  if (language === 'HazelGFGer') {
    if (personal) return [...pieces, piece(personal, 'affix', marked ? agreement : [...inflection, ...agreement])]
    return withZero(marked ? pieces : withZero(pieces, inflection), agreement)
  }
  if (language === 'HazelGFEng') return marked ? pieces : withZero(pieces, [...inflection, ...agreement])
  return withZero(marked ? pieces : withZero(pieces, inflection), agreement)
}
