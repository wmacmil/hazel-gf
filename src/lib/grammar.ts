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
  c('PositA', 'adjective phrase', ['A'], 'AP'),
  c('AdAP', 'degree + adjective', ['AdA', 'AP'], 'AP'),
  c('AdjCN', 'adjective + noun', ['AP', 'CN'], 'CN'),
  c('UseAP', 'be + adjective', ['AP'], 'VP'),
  c('ExistNP', 'there is …', ['NP'], 'Cl'),
  c('ConjNP', 'noun phrase coordination', ['Conj', 'NP', 'NP'], 'NP'),
  c('ConjS', 'sentence coordination', ['Conj', 'S', 'S'], 'S'),
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
  c('BirdN', 'bird', [], 'N'), c('ChildN', 'child', [], 'N'), c('AppleN', 'apple', [], 'N'),
  c('CarN', 'car', [], 'N'), c('FriendN', 'friend', [], 'N'), c('TeacherN', 'teacher', [], 'N'),
  c('SingV', 'sing', [], 'V'), c('SwimV', 'swim', [], 'V'), c('ComeV', 'come', [], 'V'),
  c('EatV2', 'eat', [], 'V2'), c('BuyV2', 'buy', [], 'V2'), c('HelpV2', 'help', [], 'V2'),
  c('BigA', 'big', [], 'A'), c('SmallA', 'small', [], 'A'), c('OldA', 'old', [], 'A'),
  c('RedA', 'red', [], 'A'), c('HappyA', 'happy', [], 'A'), c('GoodA', 'good', [], 'A'),
  c('HereAdv', 'here', [], 'Adv'), c('TodayAdv', 'today', [], 'Adv'), c('OftenAdv', 'often', [], 'Adv'),
  c('VeryAdA', 'very', [], 'AdA'),
  c('EveryDet', 'every', [], 'Det'), c('SomeDet', 'some', [], 'Det'),
  c('AndConj', 'and', [], 'Conj'), c('OrConj', 'or', [], 'Conj'),
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
