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
