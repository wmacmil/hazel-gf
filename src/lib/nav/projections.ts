// Our tree and its two drawn projections, seen by the navigation theory:
// one structural index, two geometries (the SvelteFlow wiring diagram and the
// phrase boxes under a sentence), and the sentence lane s/d walks. Pure.

import { phraseBoxes } from '../boxes'
import { CARD, operadFlow } from '../flow'
import type { LinearizationProjection, Node, NodeId } from '../model'
import type { GraphGeometry, GraphRect, StructuralNavigationIndex } from './graph-theory'

/**
 * Parent, first child, siblings, and preorder neighbours of every node. A
 * forest (the builder's fragments) is one index: each fragment is a root,
 * preorder runs through them in turn, and a level spans every fragment, so
 * h/l crosses from one fragment to the next at the same depth.
 */
export function structureOf(forest: Node | Node[]): StructuralNavigationIndex {
  const roots = Array.isArray(forest) ? forest : [forest]
  const parent = new Map<string, string>()
  const firstChild = new Map<string, string>()
  const previousSibling = new Map<string, string>()
  const nextSibling = new Map<string, string>()
  const order: string[] = []
  const visit = (node: Node) => {
    order.push(node.id)
    if (node.kind !== 'apply') return
    node.children.forEach((child, index) => {
      parent.set(child.id, node.id)
      if (index === 0) firstChild.set(node.id, child.id)
      if (index > 0) previousSibling.set(child.id, node.children[index - 1].id)
      if (index < node.children.length - 1) nextSibling.set(child.id, node.children[index + 1].id)
      visit(child)
    })
  }
  roots.forEach(visit)
  const previous = new Map(order.slice(1).map((id, index) => [id, order[index]]))
  const next = new Map(order.slice(0, -1).map((id, index) => [id, order[index + 1]]))
  // Each level in reading (preorder) order: the row a node sits on in both drawings.
  const depth = new Map<string, number>(roots.map(root => [root.id, 0]))
  for (const id of order) if (parent.has(id)) depth.set(id, depth.get(parent.get(id)!)! + 1)
  const previousOnLevel = new Map<string, string>()
  const nextOnLevel = new Map<string, string>()
  const levels = new Map<number, string[]>()
  for (const id of order) levels.set(depth.get(id)!, [...(levels.get(depth.get(id)!) ?? []), id])
  for (const row of levels.values()) row.forEach((id, index) => {
    if (index > 0) previousOnLevel.set(id, row[index - 1])
    if (index < row.length - 1) nextOnLevel.set(id, row[index + 1])
  })
  return { roots: roots.map(root => root.id), focusable: new Set(order), parent, firstChild, previousSibling, nextSibling, previous, next, previousOnLevel, nextOnLevel }
}

/** The wiring diagram's world geometry: the same tidy layout SvelteFlow draws. */
export function flowGeometry(root: Node): GraphGeometry {
  const rects = new Map<string, GraphRect>()
  for (const node of operadFlow(root).nodes) rects.set(node.id, { ...node.position, width: CARD.width, height: CARD.height })
  return { rects }
}

/**
 * The phrase boxes under one sentence, as geometry: x in word positions, y in
 * box rows (root on top). A discontinuous node (hat … geschlafen) is measured
 * by its first run, so left/right stays within reading order.
 */
export function boxGeometry(root: Node, projection: LinearizationProjection): GraphGeometry {
  const rects = new Map<string, GraphRect>()
  for (const box of phraseBoxes(root, projection)) {
    const [start, end] = box.runs[0]
    rects.set(box.node, { x: start, y: box.row, width: end - start + 1, height: 1 })
  }
  return { rects }
}

/** Where the s/d lane stands: a word position in one language's sentence, and the node it landed on. */
export type WordStop = { language: string; index: number; nodeId: NodeId }

/**
 * The node a word lands on: a leaf it realizes if it has one (doesn't → Negative,
 * hat → its tense leaf, im → InPrep), else the deepest node GF attributed it to.
 * Auxiliaries are attributed to the whole clause, which would otherwise swallow focus.
 */
function landingNode(root: Node, realizedBy: NodeId[]): NodeId | null {
  const depth = new Map<string, number>()
  const leaves = new Set<string>()
  const visit = (node: Node, level: number) => {
    depth.set(node.id, level)
    if (node.kind !== 'apply' || !node.children.length) leaves.add(node.id)
    if (node.kind === 'apply') node.children.forEach(child => visit(child, level + 1))
  }
  visit(root, 0)
  const known = realizedBy.filter(id => depth.has(id))
  return known.find(id => leaves.has(id)) ?? [...known].sort((a, b) => depth.get(b)! - depth.get(a)!)[0] ?? null
}

/**
 * s/d: side to side along one sentence. The lane keeps its own position, like
 * docconfig's document stops: from the last stop if focus is still on it, else
 * from the first word the focused node (or its nearest yielding ancestor)
 * yields. It never changes tree traversal; it only chooses where to land.
 */
export function stepWord(root: Node, projection: LinearizationProjection, focus: NodeId, step: 'previous' | 'next', last?: WordStop): WordStop | null {
  const words = projection.segments
  if (!words.length) return null
  let index = last && last.language === projection.language && last.nodeId === focus && last.index < words.length ? last.index : -1
  if (index < 0) {
    const { parent } = structureOf(root)
    let anchor: string | undefined = focus
    while (anchor && index < 0) {
      const yields = projection.nodeYields[anchor] ?? []
      index = words.findIndex(word => yields.includes(word.id))
      if (index < 0) anchor = parent.get(anchor)
    }
  }
  const target = index < 0 ? 0 : Math.min(words.length - 1, Math.max(0, index + (step === 'next' ? 1 : -1)))
  const nodeId = landingNode(root, words[target].realizedBy)
  return nodeId ? { language: projection.language, index: target, nodeId } : null
}
