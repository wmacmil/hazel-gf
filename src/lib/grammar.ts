import type { CategoryId, Constructor, ConstructorId, LanguageId } from './model'

const c = (id: ConstructorId, label: string, inputs: CategoryId[], output: CategoryId): Constructor =>
  ({ id, label, inputs, output })

export const CONSTRUCTORS: Constructor[] = [
  c('MkS', 'sentence', ['Pol', 'Cl'], 'S'),
  c('PredVP', 'predicate', ['NP', 'VP'], 'Cl'),
  c('UseV', 'intransitive phrase', ['V'], 'VP'),
  c('ComplV2', 'transitive phrase', ['V2', 'NP'], 'VP'),
  c('DetCN', 'determined noun phrase', ['Det', 'CN'], 'NP'),
  c('UseN', 'common noun', ['N'], 'CN'),
  c('UsePron', 'pronoun phrase', ['Pron'], 'NP'),
  c('Positive', 'positive', [], 'Pol'), c('Negative', 'negative', [], 'Pol'),
  c('Definite', 'the / definite', [], 'Det'), c('Indefinite', 'a / indefinite', [], 'Det'),
  c('IPron', 'I', [], 'Pron'), c('YouPron', 'you', [], 'Pron'),
  c('HePron', 'he', [], 'Pron'), c('ShePron', 'she', [], 'Pron'),
  c('WePron', 'we', [], 'Pron'), c('TheyPron', 'they', [], 'Pron'),
  c('ManN', 'man', [], 'N'), c('WomanN', 'woman', [], 'N'),
  c('HouseN', 'house', [], 'N'), c('DogN', 'dog', [], 'N'),
  c('CatN', 'cat', [], 'N'), c('BookN', 'book', [], 'N'),
  c('SleepV', 'sleep', [], 'V'), c('WalkV', 'walk', [], 'V'), c('RunV', 'run', [], 'V'),
  c('SeeV2', 'see', [], 'V2'), c('LoveV2', 'love', [], 'V2'), c('ReadV2', 'read', [], 'V2'),
]

export const constructorById = new Map(CONSTRUCTORS.map(item => [item.id, item]))

export function producers(category: CategoryId): Constructor[] {
  return CONSTRUCTORS.filter(item => item.output === category)
}

export function wrappers(category: CategoryId): { constructor: Constructor; inputIndex: number }[] {
  return CONSTRUCTORS.flatMap(constructor => constructor.inputs.flatMap((input, inputIndex) =>
    input === category ? [{ constructor, inputIndex }] : []))
}

export function profile(constructor: Constructor): string {
  return `(${constructor.inputs.join(', ')}) → ${constructor.output}`
}

type Lexicon = Record<string, string>
export const partialLexicon: Record<LanguageId, Lexicon> = {
  HazelGFEng: {
    Positive: '', Negative: 'not', Definite: 'the', Indefinite: 'a', IPron: 'I', YouPron: 'you',
    HePron: 'he', ShePron: 'she', WePron: 'we', TheyPron: 'they', ManN: 'man', WomanN: 'woman',
    HouseN: 'house', DogN: 'dog', CatN: 'cat', BookN: 'book', SleepV: 'sleep', WalkV: 'walk',
    RunV: 'run', SeeV2: 'see', LoveV2: 'love', ReadV2: 'read',
  },
  HazelGFGer: {
    Positive: '', Negative: 'nicht', Definite: 'der/die/das', Indefinite: 'ein/eine', IPron: 'ich',
    YouPron: 'du', HePron: 'er', ShePron: 'sie', WePron: 'wir', TheyPron: 'sie', ManN: 'Mann',
    WomanN: 'Frau', HouseN: 'Haus', DogN: 'Hund', CatN: 'Katze', BookN: 'Buch', SleepV: 'schlafen',
    WalkV: 'gehen', RunV: 'laufen', SeeV2: 'sehen', LoveV2: 'lieben', ReadV2: 'lesen',
  },
  HazelGFSwe: {
    Positive: '', Negative: 'inte', Definite: 'DEF', Indefinite: 'en/ett', IPron: 'jag', YouPron: 'du',
    HePron: 'han', ShePron: 'hon', WePron: 'vi', TheyPron: 'de', ManN: 'man', WomanN: 'kvinna',
    HouseN: 'hus', DogN: 'hund', CatN: 'katt', BookN: 'bok', SleepV: 'sova', WalkV: 'gå',
    RunV: 'springa', SeeV2: 'se', LoveV2: 'älska', ReadV2: 'läsa',
  },
}
