import { constructorById } from './grammar'
import type { ApplyNode, CategoryId, ConstructorId, EditorDocument, Node, NodeId } from './model'

let sequence = 0
export const freshId = () => `n${++sequence}`

export function hole(expected: CategoryId): Node {
  return { kind: 'hole', id: freshId(), expected }
}

export function newDocument(): EditorDocument {
  const root = hole('S')
  return {
    schemaVersion: 1,
    grammar: { name: 'HazelGF', fingerprint: 'hazel-gf-v2' },
    startCategory: 'S',
    root,
    focus: root.id,
  }
}

export const outputOf = (node: Node): CategoryId => node.kind === 'hole' ? node.expected : node.output

export function findNode(root: Node, id: NodeId): Node | undefined {
  if (root.id === id) return root
  if (root.kind === 'apply') {
    for (const child of root.children) {
      const found = findNode(child, id)
      if (found) return found
    }
  }
}

export function pathTo(root: Node, id: NodeId, path: number[] = []): number[] | undefined {
  if (root.id === id) return path
  if (root.kind === 'apply') {
    for (let index = 0; index < root.children.length; index++) {
      const found = pathTo(root.children[index], id, [...path, index])
      if (found) return found
    }
  }
}

export function nodeAt(root: Node, path: number[]): Node {
  let node = root
  for (const index of path) {
    if (node.kind !== 'apply' || !node.children[index]) throw new Error('Invalid focus path')
    node = node.children[index]
  }
  return node
}

export function replaceNode(root: Node, id: NodeId, replacement: Node): Node {
  if (root.id === id) return replacement
  if (root.kind === 'hole') return root
  return { ...root, children: root.children.map(child => replaceNode(child, id, replacement)) }
}

export function fillFocused(document: EditorDocument, constructorId: ConstructorId): EditorDocument {
  const focus = findNode(document.root, document.focus)
  const constructor = constructorById.get(constructorId)
  if (!focus || focus.kind !== 'hole') throw new Error('Only a hole can be filled')
  if (!constructor || constructor.output !== focus.expected) throw new Error('Constructor output does not match hole')
  const replacement: ApplyNode = {
    kind: 'apply', id: focus.id, constructor: constructor.id, output: constructor.output,
    children: constructor.inputs.map(hole),
  }
  const nextFocus = replacement.children[0]?.id ?? replacement.id
  return { ...document, root: replaceNode(document.root, focus.id, replacement), focus: nextFocus }
}

/** Replace one leaf by another nullary operation of the same color, keeping the node's identity. */
export function swapLeaf(root: Node, id: NodeId, constructorId: ConstructorId): Node {
  const leaf = findNode(root, id)
  const constructor = constructorById.get(constructorId)
  if (!leaf || leaf.kind !== 'apply' || leaf.children.length) throw new Error('Only a filled leaf can be swapped')
  if (!constructor || constructor.inputs.length || constructor.output !== leaf.output) throw new Error('Constructor output does not match leaf')
  return replaceNode(root, id, { ...leaf, constructor: constructor.id })
}

export function clearFocused(document: EditorDocument): EditorDocument {
  const focus = findNode(document.root, document.focus)
  if (!focus) return document
  const replacement: Node = { kind: 'hole', id: focus.id, expected: outputOf(focus) }
  return { ...document, root: replaceNode(document.root, focus.id, replacement) }
}

export function wrapFocused(document: EditorDocument, constructorId: ConstructorId, inputIndex: number): EditorDocument {
  const focus = findNode(document.root, document.focus)
  const constructor = constructorById.get(constructorId)
  if (!focus || !constructor || constructor.inputs[inputIndex] !== outputOf(focus)
    || constructor.output !== outputOf(focus)) {
    throw new Error('Wrapper input does not match focused category')
  }
  const children = constructor.inputs.map(hole)
  children[inputIndex] = focus
  const wrapper: ApplyNode = {
    kind: 'apply', id: freshId(), constructor: constructor.id, output: constructor.output, children,
  }
  return { ...document, root: replaceNode(document.root, focus.id, wrapper), focus: wrapper.id }
}

/** Why a subtree cannot be plugged into `parent`'s input `port`, or undefined if it can. */
export function moveProblem(root: Node, subtreeId: NodeId, parentId: NodeId, port: number): string | undefined {
  const subtree = findNode(root, subtreeId)
  const parent = findNode(root, parentId)
  if (!subtree || !parent || parent.kind !== 'apply') return 'Unknown node'
  if (subtree.id === root.id) return 'The root has no output to move'
  const slot = parent.children[port]
  const expected = constructorById.get(parent.constructor)?.inputs[port]
  if (!slot || !expected) return 'Unknown input port'
  if (slot.kind !== 'hole') return 'A subtree can only be plugged into a hole'
  if (outputOf(subtree) !== expected) return `Sort ${outputOf(subtree)} does not match port ${expected}`
  if (findNode(subtree, parent.id)) return 'A subtree cannot be plugged into itself'
}

/** Move a subtree into a typed hole elsewhere; its old slot becomes a hole of the same sort. */
export function moveSubtree(document: EditorDocument, subtreeId: NodeId, parentId: NodeId, port: number): EditorDocument {
  const problem = moveProblem(document.root, subtreeId, parentId, port)
  if (problem) throw new Error(problem)
  const subtree = findNode(document.root, subtreeId)!
  const slot = (findNode(document.root, parentId) as ApplyNode).children[port]
  const vacated = replaceNode(document.root, subtree.id, hole(outputOf(subtree)))
  return { ...document, root: replaceNode(vacated, slot.id, subtree), focus: subtree.id }
}

export function moveFocus(document: EditorDocument, direction: 'parent' | 'firstChild' | 'previous' | 'next'): EditorDocument {
  const path = pathTo(document.root, document.focus)
  if (!path) return document
  let target = path
  if (direction === 'parent' && path.length) target = path.slice(0, -1)
  if (direction === 'firstChild') {
    const node = nodeAt(document.root, path)
    if (node.kind === 'apply' && node.children.length) target = [...path, 0]
  }
  if ((direction === 'previous' || direction === 'next') && path.length) {
    const parentPath = path.slice(0, -1)
    const parent = nodeAt(document.root, parentPath)
    const index = path.at(-1)!
    if (parent.kind === 'apply') {
      const next = direction === 'previous' ? index - 1 : index + 1
      if (parent.children[next]) target = [...parentPath, next]
    }
  }
  return { ...document, focus: nodeAt(document.root, target).id }
}

export function isComplete(node: Node): boolean {
  return node.kind === 'apply' && node.children.every(isComplete)
}

export function toGfTerm(node: Node): string {
  if (node.kind === 'hole') throw new Error(`Incomplete ${node.expected} hole`)
  const args = node.children.map(child => {
    const term = toGfTerm(child)
    return child.kind === 'apply' && child.children.length ? `(${term})` : term
  })
  return [node.constructor, ...args].join(' ')
}

/** Parse a complete GF term back into an editor tree (the inverse of toGfTerm). */
export function fromGfTerm(term: string): Node {
  const tokens = term.match(/[()]|[^\s()]+/g) ?? []
  let index = 0
  const node = (): Node => {
    if (tokens[index] === '(') { index++; const inner = node(); index++; return inner }
    const constructor = constructorById.get(tokens[index++])
    if (!constructor) throw new Error(`Unknown constructor in ${term}`)
    return { kind: 'apply', id: freshId(), constructor: constructor.id, output: constructor.output, children: constructor.inputs.map(() => node()) }
  }
  return node()
}

export function validateDocument(value: unknown): value is EditorDocument {
  if (!value || typeof value !== 'object') return false
  const doc = value as Partial<EditorDocument>
  if (doc.schemaVersion !== 1 || doc.grammar?.fingerprint !== 'hazel-gf-v2' || !doc.root || !doc.focus) return false
  const visit = (node: Node, expected: CategoryId): boolean => {
    if (!node || outputOf(node) !== expected) return false
    if (node.kind === 'hole') return true
    const constructor = constructorById.get(node.constructor)
    return !!constructor && constructor.output === node.output && constructor.inputs.length === node.children.length
      && node.children.every((child, index) => visit(child, constructor.inputs[index]))
  }
  return visit(doc.root, 'S') && !!findNode(doc.root, doc.focus)
}

export function preorder(node: Node): Node[] {
  return node.kind === 'hole' ? [node] : [node, ...node.children.flatMap(preorder)]
}
