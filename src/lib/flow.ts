import { constructorById } from './grammar'
import { outputOf } from './editor'
import type { CategoryId, Node, NodeId } from './model'

export type OperadNodeData = { node: Node; inputs: CategoryId[] }
export type FlowNode = { id: NodeId; type: 'operation'; position: { x: number; y: number }; data: OperadNodeData; draggable: boolean }
export type FlowEdge = {
  id: string; source: NodeId; sourceHandle: 'out'; target: NodeId; targetHandle: string
  data: { sort: CategoryId }
}

export const CARD = { width: 188, height: 92, gapX: 22, gapY: 70 }

/**
 * The operad as a wiring diagram: every tree node is an operation (or typed
 * hole) whose output feeds one input port of its parent. The layout is a tidy
 * tree that keeps ports in argument order, left to right.
 */
export function operadFlow(root: Node): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const width = (node: Node): number => node.kind === 'apply' && node.children.length
    ? Math.max(CARD.width, node.children.reduce((total, child) => total + width(child), 0) + CARD.gapX * (node.children.length - 1))
    : CARD.width
  const place = (node: Node, left: number, depth: number) => {
    const span = width(node)
    const inputs = node.kind === 'apply' ? constructorById.get(node.constructor)?.inputs ?? [] : []
    nodes.push({
      id: node.id, type: 'operation', draggable: false,
      position: { x: left + (span - CARD.width) / 2, y: depth * (CARD.height + CARD.gapY) },
      data: { node, inputs },
    })
    if (node.kind !== 'apply') return
    let cursor = left + (span - (node.children.reduce((total, child) => total + width(child), 0) + CARD.gapX * (node.children.length - 1))) / 2
    node.children.forEach((child, port) => {
      edges.push({ id: `${child.id}->${node.id}:${port}`, source: child.id, sourceHandle: 'out', target: node.id, targetHandle: `in-${port}`, data: { sort: outputOf(child) } })
      place(child, cursor, depth + 1)
      cursor += width(child) + CARD.gapX
    })
  }
  place(root, 0, 0)
  return { nodes, edges }
}

/** Parse a target handle id (`in-2`) back to its port index. */
export const portOf = (handle: string | null | undefined) => handle?.startsWith('in-') ? Number(handle.slice(3)) : -1
