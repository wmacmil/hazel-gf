import { constructorById } from './grammar'
import { findNode, freshId, hole, isComplete, outputOf, preorder, replaceNode } from './editor'
import type { ApplyNode, ConstructorId, Node, NodeId } from './model'

/**
 * The optional tree builder, after working-app's Operad14: a workbench of
 * fragments (partial trees) placed freely, wired together by typed
 * connections. A connection plugs one fragment's root into a hole of another,
 * and is allowed only when the sorts agree and the hole is free — the kernel,
 * not the canvas, decides. A complete S fragment can be adopted as the sentence.
 */
export type Workbench = { fragments: Node[] }

export const emptyBench = (): Workbench => ({ fragments: [] })

const fragmentOf = (bench: Workbench, id: NodeId) => bench.fragments.find(fragment => findNode(fragment, id))

/** A new fragment: the operation with a typed hole for each argument (or a ready-made expression). */
export function addFragment(bench: Workbench, operation: ConstructorId | Node): Workbench {
  let fragment: Node
  if (typeof operation === 'string') {
    const declaration = constructorById.get(operation)
    if (!declaration) throw new Error(`Unknown operation ${operation}`)
    fragment = { kind: 'apply', id: freshId(), constructor: declaration.id, output: declaration.output, children: declaration.inputs.map(hole) }
  } else {
    fragment = operation
  }
  return { fragments: [...bench.fragments, fragment] }
}

/** Why `childRoot` cannot be plugged into `parent`'s input `port`, or undefined if it can. */
export function plugProblem(bench: Workbench, childRoot: NodeId, parentId: NodeId, port: number): string | undefined {
  const child = bench.fragments.find(fragment => fragment.id === childRoot)
  if (!child) return 'Only a fragment’s root can be plugged in'
  const home = fragmentOf(bench, parentId)
  if (!home) return 'Unknown target'
  if (home === child) return 'A fragment cannot be plugged into itself'
  const parent = findNode(home, parentId)
  if (!parent || parent.kind !== 'apply') return 'Unknown target'
  const slot = parent.children[port]
  const expected = constructorById.get(parent.constructor)?.inputs[port]
  if (!slot || !expected) return 'Unknown input port'
  if (slot.kind !== 'hole') return 'That port is already connected'
  if (outputOf(child) !== expected) return `Sort ${outputOf(child)} does not match port ${expected}`
}

export function plug(bench: Workbench, childRoot: NodeId, parentId: NodeId, port: number): Workbench {
  const problem = plugProblem(bench, childRoot, parentId, port)
  if (problem) throw new Error(problem)
  const child = bench.fragments.find(fragment => fragment.id === childRoot)!
  const home = fragmentOf(bench, parentId)!
  const slot = (findNode(home, parentId) as ApplyNode).children[port]
  return {
    fragments: bench.fragments
      .filter(fragment => fragment !== child)
      .map(fragment => fragment === home ? replaceNode(fragment, slot.id, child) : fragment),
  }
}

/** Cut a subtree out into its own fragment, leaving a hole of its sort (a fragment root stays put). */
export function detach(bench: Workbench, nodeId: NodeId): Workbench {
  const home = fragmentOf(bench, nodeId)
  if (!home || home.id === nodeId) return bench
  const subtree = findNode(home, nodeId)!
  return {
    fragments: [...bench.fragments.map(fragment => fragment === home ? replaceNode(fragment, nodeId, hole(outputOf(subtree))) : fragment), subtree],
  }
}

export const removeFragment = (bench: Workbench, rootId: NodeId): Workbench =>
  ({ fragments: bench.fragments.filter(fragment => fragment.id !== rootId) })

/** Fragments that are whole sentences: complete, of sort S — adoptable as the document. */
export const adoptable = (fragment: Node) => outputOf(fragment) === 'S' && isComplete(fragment)

/** The number of typed holes still open across the workbench. */
export const openHoles = (bench: Workbench) => bench.fragments.flatMap(fragment => preorder(fragment)).filter(node => node.kind === 'hole').length
