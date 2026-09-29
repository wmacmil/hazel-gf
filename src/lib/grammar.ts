import type { CategoryId, Constructor, ConstructorId } from './model'

const c = (id: ConstructorId, label: string, inputs: CategoryId[], output: CategoryId): Constructor =>
  ({ id, label, inputs, output })

export const CONSTRUCTORS: Constructor[] = [
  c('MkS', 'sentence', ['Temp', 'Pol', 'Cl'], 'S'),
  c('PredVP', 'predicate', ['NP', 'VP'], 'Cl'),
  c('UseV', 'intransitive phrase', ['V'], 'VP'),
  c('ComplV2', 'transitive phrase', ['V2', 'NP'], 'VP'),
  c('DetCN', 'determined noun phrase', ['Det', 'CN'], 'NP'),
  c('UseN', 'common noun', ['N'], 'CN'),
  c('UsePron', 'pronoun phrase', ['Pron'], 'NP'),
  c('PrepNP', 'prepositional phrase', ['Prep', 'NP'], 'Adv'),
  c('AdvVP', 'verb phrase + adverbial', ['VP', 'Adv'], 'VP'),
  c('AdvCN', 'noun + adverbial', ['CN', 'Adv'], 'CN'),
  c('Positive', 'positive', [], 'Pol'), c('Negative', 'negative', [], 'Pol'),
  c('Present', 'present', [], 'Temp'), c('Past', 'past', [], 'Temp'),
  c('Future', 'future', [], 'Temp'), c('Conditional', 'conditional', [], 'Temp'),
  c('PresentPerfect', 'present perfect', [], 'Temp'), c('PastPerfect', 'past perfect', [], 'Temp'),
  c('FuturePerfect', 'future perfect', [], 'Temp'), c('ConditionalPerfect', 'conditional perfect', [], 'Temp'),
  c('Definite', 'the / definite', [], 'Det'), c('Indefinite', 'a / indefinite', [], 'Det'),
  c('IPron', 'I', [], 'Pron'), c('YouPron', 'you', [], 'Pron'),
  c('HePron', 'he', [], 'Pron'), c('ShePron', 'she', [], 'Pron'),
  c('WePron', 'we', [], 'Pron'), c('TheyPron', 'they', [], 'Pron'),
  c('ManN', 'man', [], 'N'), c('WomanN', 'woman', [], 'N'),
  c('HouseN', 'house', [], 'N'), c('DogN', 'dog', [], 'N'),
  c('CatN', 'cat', [], 'N'), c('BookN', 'book', [], 'N'),
  c('TableN', 'table', [], 'N'), c('GardenN', 'garden', [], 'N'), c('CityN', 'city', [], 'N'),
  c('InPrep', 'in', [], 'Prep'), c('OnPrep', 'on', [], 'Prep'), c('WithPrep', 'with', [], 'Prep'),
  c('ToPrep', 'to', [], 'Prep'), c('UnderPrep', 'under', [], 'Prep'),
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
