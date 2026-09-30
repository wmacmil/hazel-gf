<script lang="ts">
  import { Background, BackgroundVariant, Controls, SvelteFlow, type Connection, type Edge, type Node as FlowNodeType } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'
  import BuilderNode from './BuilderNode.svelte'
  import FitOnChange from './FitOnChange.svelte'
  import { profile } from '../lib/grammar'
  import { adoptable, addFragment, detach, openHoles, plug, plugProblem, removeFragment, type Workbench } from '../lib/builder'
  import { CARD, operadFlow, portOf } from '../lib/flow'
  import type { Paradigms } from '../lib/morphology'
  import type { Node } from '../lib/model'
  import { sortColor } from '../lib/palette.svelte'
  import { searchExpressions } from '../lib/search'

  /**
   * The optional tree builder (after working-app's Operad14): place fragments
   * from a type-aware palette, drag them anywhere, wire a fragment's root into
   * a matching hole (the kernel checks every wire), click a wire to cut it,
   * and adopt a finished sentence. Drag positions are an ephemeral overlay.
   */
  let { bench, paradigms, onChange, onAdopt, onSendSentence }: {
    bench: Workbench
    paradigms: Paradigms | undefined
    onChange: (bench: Workbench) => void
    onAdopt: (fragment: Node) => void
    onSendSentence: () => void
  } = $props()

  const nodeTypes = { builder: BuilderNode }
  let nodes = $state.raw<FlowNodeType[]>([])
  let edges = $state.raw<Edge[]>([])
  let dragged = $state<Record<string, { x: number; y: number }>>({})
  let refusal = $state('')
  let query = $state('')
  const results = $derived(searchExpressions(query, undefined, paradigms, 10))

  $effect(() => {
    const laidOut: FlowNodeType[] = []
    const wires: Edge[] = []
    let offset = 0
    for (const fragment of bench.fragments) {
      const flow = operadFlow(fragment)
      const width = Math.max(...flow.nodes.map(node => node.position.x)) + CARD.width
      for (const node of flow.nodes) {
        laidOut.push({
          ...node, type: 'builder', draggable: true,
          position: dragged[node.id] ?? { x: node.position.x + offset, y: node.position.y },
          data: {
            node: node.data.node, inputs: node.data.inputs,
            fragmentRoot: node.id === fragment.id, adoptable: node.id === fragment.id && adoptable(fragment),
            onAdopt: () => onAdopt(fragment), onRemove: () => onChange(removeFragment(bench, fragment.id)),
          },
        })
      }
      for (const edge of flow.edges) wires.push({ ...edge, style: `stroke:${sortColor(edge.data.sort).abstract.accent};stroke-width:1.8;cursor:pointer` })
      offset += width + 80
    }
    nodes = laidOut
    edges = wires
  })

  function isValidConnection(connection: Connection | Edge): boolean {
    const problem = plugProblem(bench, connection.source, connection.target, portOf(connection.targetHandle))
    refusal = problem ?? ''
    return !problem
  }

  function add(expression: Node) {
    onChange(addFragment(bench, expression))
    query = ''
  }
</script>

<div class="builder">
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
    onconnect={connection => onChange(plug(bench, connection.source, connection.target, portOf(connection.targetHandle)))}
    onconnectend={() => { refusal = '' }}
    onedgeclick={({ edge }) => onChange(detach(bench, edge.source))}
    onnodedragstop={({ targetNode }) => { if (targetNode) dragged = { ...dragged, [targetNode.id]: targetNode.position } }}
  >
    <Background variant={BackgroundVariant.Lines} gap={14} bgColor="#0e1520" patternColor="#182434" />
    <Controls showLock={false} />
    <!-- Fit when a new fragment appears (added, sent, or cut off), never while wiring. -->
    <FitOnChange key={bench.fragments.at(-1)?.id ?? ''} />
  </SvelteFlow>
  <p class="hint" class:refused={refusal}>
    {refusal || 'Drag a fragment’s top handle onto a matching hole · click a wire to cut it · adopt a complete sentence'}
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
