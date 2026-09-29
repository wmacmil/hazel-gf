import { outputOf } from './editor'
import type { CategoryId, LinearizationProjection, Node, NodeId } from './model'

/** One tree node's region over a linearization: a set of contiguous word runs. */
export type PhraseBox = {
  node: NodeId
  category: CategoryId
  label: string
  depth: number
  /** Display row: the first row below the parent's where every run is free. */
  row: number
  /** Inclusive word-index runs; more than one run means the yield is discontinuous (wird … schlafen). */
  runs: [number, number][]
}

/**
 * The little-discs picture of a tree over its surface: every node that yields
 * words becomes a box spanning them, one row per tree depth.
 */
export function phraseBoxes(root: Node, projection: LinearizationProjection): PhraseBox[] {
  const position = new Map(projection.segments.map((segment, index) => [segment.id, index]))
  const boxes: PhraseBox[] = []
  const occupied: boolean[][] = []
  const free = (row: number, runs: [number, number][]) =>
    runs.every(([start, end]) => { for (let i = start; i <= end; i++) if (occupied[row]?.[i]) return false; return true })
  const visit = (node: Node, depth: number, parentRow: number) => {
    const indices = (projection.nodeYields[node.id] ?? [])
      .map(id => position.get(id))
      .filter((index): index is number => index !== undefined)
      .sort((a, b) => a - b)
    if (indices.length) {
      const runs: [number, number][] = []
      for (const index of indices) {
        const last = runs.at(-1)
        if (last && index === last[1] + 1) last[1] = index
        else if (!last || index > last[1]) runs.push([index, index])
      }
      let row = parentRow + 1
      while (!free(row, runs)) row++
      for (const [start, end] of runs) for (let i = start; i <= end; i++) (occupied[row] ??= [])[i] = true
      boxes.push({ node: node.id, category: outputOf(node), label: node.kind === 'apply' ? node.constructor : '?', depth, row, runs })
      parentRow = row
    }
    if (node.kind === 'apply') node.children.forEach(child => visit(child, depth + 1, parentRow))
  }
  visit(root, 0, -1)
  return boxes
}
