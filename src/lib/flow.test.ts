import { describe, expect, it } from 'vitest'
import { agreementExample, exampleDocument } from './examples'
import { findNode, outputOf, preorder } from './editor'
import { constructorById } from './grammar'
import { CARD, operadFlow, portOf } from './flow'
import type { ApplyNode } from './model'

describe('the operad as a SvelteFlow wiring diagram', () => {
  it('has one node per tree node and only well-sorted wires', () => {
    for (const document of [exampleDocument(), agreementExample()]) {
      const { nodes, edges } = operadFlow(document.root)
      expect(nodes).toHaveLength(preorder(document.root).length)
      expect(edges).toHaveLength(preorder(document.root).length - 1)
      for (const edge of edges) {
        const parent = findNode(document.root, edge.target) as ApplyNode
        const child = findNode(document.root, edge.source)!
        const port = portOf(edge.targetHandle)
        expect(parent.children[port].id).toBe(child.id)
        expect(constructorById.get(parent.constructor)!.inputs[port]).toBe(outputOf(child))
      }
    }
  })

  it('lays ports out in argument order without overlapping cards', () => {
    const document = exampleDocument()
    const { nodes } = operadFlow(document.root)
    const byId = new Map(nodes.map(node => [node.id, node]))
    for (const node of preorder(document.root)) {
      if (node.kind !== 'apply') continue
      const xs = node.children.map(child => byId.get(child.id)!.position.x)
      expect(xs).toEqual([...xs].sort((a, b) => a - b))
    }
    for (const a of nodes) for (const b of nodes) {
      if (a === b || a.position.y !== b.position.y) continue
      expect(Math.abs(a.position.x - b.position.x)).toBeGreaterThanOrEqual(CARD.width)
    }
  })
})
