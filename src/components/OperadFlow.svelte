<script lang="ts">
  import { Background, BackgroundVariant, Controls, SvelteFlow, type Connection, type Edge, type Node as FlowNodeType } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'
  import { setContext } from 'svelte'
  import FlowOperationNode from './FlowOperationNode.svelte'
  import FitOnChange from './FitOnChange.svelte'
  import { moveProblem } from '../lib/editor'
  import { operadFlow, portOf } from '../lib/flow'
  import { CATEGORY_COLORS, type Node, type NodeId } from '../lib/model'

  let {
    root, focus, linked = [], onFocus, onHover, onMove,
  }: {
    root: Node
    focus: NodeId
    linked?: NodeId[]
    onFocus: (id: NodeId) => void
    onHover: (ids: NodeId[]) => void
    onMove: (subtree: NodeId, parent: NodeId, port: number) => void
  } = $props()

  const nodeTypes = { operation: FlowOperationNode }
  let nodes = $state.raw<FlowNodeType[]>([])
  let edges = $state.raw<Edge[]>([])
  /** The kernel's reason for refusing the connection being drawn, shown under the canvas. */
  let refusal = $state('')
  /** Tree shape only (not focus), so hovering never re-fits the viewport. */
  const shape = $derived(JSON.stringify(root, (key, value) => key === 'id' ? undefined : value))

  // The canvas is a projection of the document: rebuilt from the tree on every
  // change, never edited in place. Edits go through editor.ts via onMove.
  // Focus and hover reach the cards through context, so they never replace the
  // node array (which would abort a connection being drawn).
  setContext('operad-highlight', { get focus() { return focus }, get linked() { return linked } })
  $effect(() => {
    const flow = operadFlow(root)
    nodes = flow.nodes.map(node => ({ ...node, data: { ...node.data, isRoot: node.id === root.id } }))
    edges = flow.edges.map(edge => ({
      ...edge,
      style: `stroke:${CATEGORY_COLORS[edge.data.sort].glow};stroke-width:1.6;opacity:.8`,
    }))
  })

  function isValidConnection(connection: Connection | Edge): boolean {
    const problem = moveProblem(root, connection.source, connection.target, portOf(connection.targetHandle))
    refusal = problem ?? ''
    return !problem
  }
</script>

<div class="operad-flow">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {isValidConnection}
    colorMode="dark"
    fitView
    nodesDraggable={false}
    deleteKey={null}
    minZoom={0.2}
    proOptions={{ hideAttribution: true }}
    onnodeclick={({ node }) => onFocus(node.id)}
    onnodepointerenter={({ node }) => onHover([node.id])}
    onnodepointerleave={() => onHover([])}
    onconnect={connection => onMove(connection.source, connection.target, portOf(connection.targetHandle))}
    onconnectend={() => { refusal = '' }}
  >
    <Background variant={BackgroundVariant.Lines} gap={14} bgColor="#0e1520" patternColor="#182434" />
    <Controls showLock={false} />
    <FitOnChange key={shape} />
  </SvelteFlow>
  <p class="hint" class:refused={refusal}>
    {refusal || 'Drag a node’s top handle onto a matching hole port to move that subtree. The kernel checks every wire.'}
  </p>
</div>

<style>
  .operad-flow { position: absolute; inset: 0; }
  .hint {
    position: absolute; left: .8rem; bottom: .6rem; margin: 0; padding: .25rem .5rem; border-radius: 3px;
    color: #6f86a6; background: #0e1520cc; font: .6rem ui-monospace, monospace; pointer-events: none;
  }
  .hint.refused { color: #ffb4a8; }
</style>
