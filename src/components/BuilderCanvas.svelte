<script lang="ts">
  import { Background, BackgroundVariant, Controls, SvelteFlow, type Connection, type Edge, type Node as FlowNodeType } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'
  import BuilderNode from './BuilderNode.svelte'
  import FitOnChange from './FitOnChange.svelte'
  import CameraFollow from './CameraFollow.svelte'
  import { setContext, untrack } from 'svelte'
  import { profile } from '../lib/grammar'
  import { preorder } from '../lib/editor'
  import { adoptable, addFragment, detach, openHoles, plug, plugProblem, removeFragment, type Workbench } from '../lib/builder'
  import { CARD, operadFlow, portOf } from '../lib/flow'
  import type { Paradigms } from '../lib/morphology'
  import type { Node, NodeId } from '../lib/model'
  import { sortColor } from '../lib/palette.svelte'
  import { searchExpressions } from '../lib/search'

  /**
   * The optional tree builder (after working-app's Operad14): place fragments
   * from a type-aware palette, drag them anywhere, wire a fragment's root into
   * a matching hole (the kernel checks every wire), click a wire to cut it,
   * and adopt a finished sentence. Drag positions are an ephemeral overlay.
   */
  let { bench, paradigms, focus, camera, fitSeq = 0, onFocus, onChange, onAdopt, onSendSentence }: {
    bench: Workbench
    paradigms: Paradigms | undefined
    /** The bench's own keyboard focus (hjkl walks the fragments). */
    focus: NodeId | undefined
    camera?: { nodeId: string; seq: number }
    fitSeq?: number
    onFocus: (id: NodeId) => void
    onChange: (bench: Workbench) => void
    onAdopt: (fragment: Node) => void
    onSendSentence: () => void
  } = $props()

  const nodeTypes = { builder: BuilderNode }
  let width = $state(0)
  let height = $state(0)
  // Focus reaches the cards through context, so moving it never rebuilds the nodes (or aborts a wire).
  setContext('builder-focus', { get focus() { return focus } })
  let nodes = $state.raw<FlowNodeType[]>([])
  let edges = $state.raw<Edge[]>([])
  let dragged = $state<Record<string, { x: number; y: number }>>({})
  let refusal = $state('')
  let query = $state('')
  const results = $derived(searchExpressions(query, undefined, paradigms, 10))

  /**
   * Where each fragment sits: its root's origin, fixed once it appears, so the
   * bench never re-flows and the camera never has to chase it (it moves only
   * on keyboard focus or `=`). A new fragment appears in the middle of the
   * view; a cut subtree stays exactly where it was drawn. Not reactive: it is
   * bookkeeping for the layout below, written only while laying out.
   */
  const origins = new Map<string, { x: number; y: number }>()
  let viewport = { x: 0, y: 0, zoom: 1 }
  /** The first layout is a bench restored from storage: laid side by side and fitted once. */
  let restoring = true

  /** Where a newly seen fragment's root goes, in flow coordinates. */
  function originFor(fragment: Node, index: number) {
    // Cut off an existing tree: the subtree's root stays where it was drawn.
    const drawn = nodes.find(node => node.id === fragment.id)
    if (drawn) return drawn.position
    // Before the canvas has a viewport (a bench restored on load): side by side, then fitted once.
    if (restoring || !width) return { x: index * 900, y: 0 }
    // Otherwise centred horizontally, a third of the way down the visible canvas,
    // cascading past any fragment already sitting there.
    const spot = { x: (width / 2 - viewport.x) / viewport.zoom - CARD.width / 2, y: (height / 3 - viewport.y) / viewport.zoom }
    const taken = [...origins.values()]
    while (taken.some(origin => Math.abs(origin.x - spot.x) < 24 && Math.abs(origin.y - spot.y) < 24)) { spot.x += 32; spot.y += 32 }
    return spot
  }

  $effect(() => {
    const laidOut: FlowNodeType[] = []
    const wires: Edge[] = []
    const live = new Set(bench.fragments.map(fragment => fragment.id))
    for (const id of origins.keys()) if (!live.has(id)) origins.delete(id)
    bench.fragments.forEach((fragment, index) => {
      const flow = operadFlow(fragment)
      const relative = new Map(flow.nodes.map(node => [node.id, node.position]))
      if (!origins.has(fragment.id)) origins.set(fragment.id, untrack(() => originFor(fragment, index)))
      const origin = origins.get(fragment.id)!
      const rootAt = relative.get(fragment.id)!
      for (const node of flow.nodes) {
        laidOut.push({
          ...node, type: 'builder', draggable: true,
          position: dragged[node.id] ?? { x: origin.x + node.position.x - rootAt.x, y: origin.y + node.position.y - rootAt.y },
          data: {
            node: node.data.node, inputs: node.data.inputs,
            fragmentRoot: node.id === fragment.id, adoptable: node.id === fragment.id && adoptable(fragment),
            onAdopt: () => onAdopt(fragment), onRemove: () => onChange(removeFragment(bench, fragment.id)),
          },
        })
      }
      for (const edge of flow.edges) wires.push({ ...edge, style: `stroke:${sortColor(edge.data.sort).abstract.accent};stroke-width:1.8;cursor:pointer` })
    })
    nodes = laidOut
    edges = wires
    restoring = false
  })

  function isValidConnection(connection: Connection | Edge): boolean {
    const problem = plugProblem(bench, connection.source, connection.target, portOf(connection.targetHandle))
    refusal = problem ?? ''
    return !problem
  }

  function add(expression: Node) {
    onChange(addFragment(bench, expression))
    onFocus(expression.id)
    query = ''
  }
</script>

<div class="builder" bind:clientWidth={width} bind:clientHeight={height}>
  <div class="palette nodrag">
    <input bind:value={query} placeholder="add: name, word, or AP -> _" aria-label="Add a fragment"
      onkeydown={event => { if (event.key === 'Enter' && results[0]) add(results[0].expression) }} />
    <div class="found">
      {#each results as result (result.path.join('>') + (result.word?.form ?? ''))}
        <button onclick={() => add(result.expression)} style:--sort={sortColor(result.operation.output).abstract.accent}>
          <b>{result.word ? result.word.form : result.operation.id}</b><span>{profile(result.operation)}</span>
        </button>
      {/each}
    </div>
    <div class="actions">
      <button onclick={onSendSentence}>+ current sentence</button>
      <button onclick={() => dragged = {}}>tidy</button>
      <button onclick={() => onChange({ fragments: [] })}>clear</button>
      <span>{bench.fragments.length} fragment{bench.fragments.length === 1 ? '' : 's'} · {openHoles(bench)} open holes</span>
    </div>
  </div>
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {isValidConnection}
    colorMode="dark"
    fitView
    deleteKey={null}
    minZoom={0.2}
    proOptions={{ hideAttribution: true }}
    onconnect={connection => {
      // A plugged fragment joins its new tree's layout, so drop where it had been dragged.
      const joined = new Set(preorder(bench.fragments.find(fragment => fragment.id === connection.source)!).map(node => node.id))
      dragged = Object.fromEntries(Object.entries(dragged).filter(([id]) => !joined.has(id)))
      onChange(plug(bench, connection.source, connection.target, portOf(connection.targetHandle)))
    }}
    onconnectend={() => { refusal = '' }}
    onmove={(_, next) => { viewport = next }}
    onnodeclick={({ node }) => onFocus(node.id)}
    onedgeclick={({ edge }) => onChange(detach(bench, edge.source))}
    onnodedragstop={({ targetNode }) => { if (targetNode) dragged = { ...dragged, [targetNode.id]: targetNode.position } }}
  >
    <Background variant={BackgroundVariant.Lines} gap={14} bgColor="#0e1520" patternColor="#182434" />
    <Controls showLock={false} />
    <!-- Fit once on entry. New fragments appear in view, so adding one never moves the camera. -->
    <FitOnChange key="bench" />
    <CameraFollow request={camera} {width} {height} {fitSeq} />
  </SvelteFlow>
  <p class="hint" class:refused={refusal}>
    {refusal || 'hjkl walks the fragments · drag a fragment’s top handle onto a matching hole · click a wire to cut it · adopt a complete sentence'}
  </p>
</div>

<style>
  .builder { position: absolute; inset: 0; }
  .palette { position: absolute; z-index: 6; top: 2rem; left: .8rem; width: 16rem; display: grid; gap: .35rem; padding: .55rem; border: 1px solid #22314a; border-radius: 5px; background: #0e1520ee; }
  .palette input { padding: .4rem .45rem; border: 1px solid #33455f; border-radius: 3px; background: #131c2a; color: #dfe7f2; font: .72rem ui-monospace, monospace; }
  .found { display: grid; gap: .2rem; max-height: 14rem; overflow-y: auto; }
  .found button { display: flex; justify-content: space-between; gap: .4rem; padding: .28rem .4rem; border: 1px solid #22314a; border-left: 3px solid var(--sort); border-radius: 3px; background: #131c2a; color: #dfe7f2; font: .66rem ui-monospace, monospace; text-align: left; cursor: pointer; }
  .found button span { color: #7d8ea6; }
  .actions { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; }
  .actions button { padding: .2rem .4rem; border: 1px solid #33455f; border-radius: 3px; background: #131c2a; color: #cfd8e4; font: .6rem ui-monospace, monospace; cursor: pointer; }
  .actions span { color: #6f86a6; font: .58rem ui-monospace, monospace; }
  .hint { position: absolute; left: .8rem; bottom: .6rem; margin: 0; padding: .25rem .5rem; border-radius: 3px; color: #6f86a6; background: #0e1520cc; font: .6rem ui-monospace, monospace; pointer-events: none; }
  .hint.refused { color: #ffb4a8; }
</style>
