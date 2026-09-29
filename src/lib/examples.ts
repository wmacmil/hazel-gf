import { constructorById } from './grammar'
import { freshId } from './editor'
import type { ApplyNode, ConstructorId, EditorDocument, Node } from './model'

function apply(constructor: ConstructorId, ...children: Node[]): ApplyNode {
  const declaration = constructorById.get(constructor)
  if (!declaration || declaration.inputs.length !== children.length) throw new Error(`Bad example node ${constructor}`)
  return { kind: 'apply', id: freshId(), constructor, output: declaration.output, children }
}

const leaf = (constructor: ConstructorId) => apply(constructor)

export function exampleDocument(): EditorDocument {
  const subject = apply('UsePron', leaf('IPron'))
  const object = apply('DetCN', leaf('Definite'), apply('UseN', leaf('WomanN')))
  const root = apply('MkS', leaf('Present'), leaf('Positive'), apply('PredVP', subject, apply('ComplV2', leaf('SeeV2'), object)))
  return {
    schemaVersion: 1,
    grammar: { name: 'HazelGF', fingerprint: 'hazel-gf-v2' },
    startCategory: 'S', root, focus: object.id,
  }
}

export function agreementExample(): EditorDocument {
  const subject = apply('DetCN', leaf('Definite'), apply('UseN', leaf('ManN')))
  const root = apply('MkS', leaf('Present'), leaf('Negative'), apply('PredVP', subject, apply('UseV', leaf('SleepV'))))
  return {
    schemaVersion: 1,
    grammar: { name: 'HazelGF', fingerprint: 'hazel-gf-v2' },
    startCategory: 'S', root, focus: subject.id,
  }
}

/** "the man sleeps in the house": a prepositional phrase adjoined to the verb phrase. */
export function prepositionExample(): EditorDocument {
  const place = apply('PrepNP', leaf('InPrep'), apply('DetCN', leaf('Definite'), apply('UseN', leaf('HouseN'))))
  const subject = apply('DetCN', leaf('Definite'), apply('UseN', leaf('ManN')))
  const root = apply('MkS', leaf('Present'), leaf('Positive'), apply('PredVP', subject, apply('AdvVP', apply('UseV', leaf('SleepV')), place)))
  return {
    schemaVersion: 1,
    grammar: { name: 'HazelGF', fingerprint: 'hazel-gf-v2' },
    startCategory: 'S', root, focus: place.id,
  }
}

/** "I see the woman with the dog": a prepositional phrase modifying a noun. */
export function modifierExample(): EditorDocument {
  const companion = apply('PrepNP', leaf('WithPrep'), apply('DetCN', leaf('Definite'), apply('UseN', leaf('DogN'))))
  const object = apply('DetCN', leaf('Definite'), apply('AdvCN', apply('UseN', leaf('WomanN')), companion))
  const root = apply('MkS', leaf('Present'), leaf('Positive'), apply('PredVP', apply('UsePron', leaf('IPron')), apply('ComplV2', leaf('SeeV2'), object)))
  return {
    schemaVersion: 1,
    grammar: { name: 'HazelGF', fingerprint: 'hazel-gf-v2' },
    startCategory: 'S', root, focus: companion.id,
  }
}
