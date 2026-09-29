<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte'
  import OperadCard from './OperadCard.svelte'
  import { getContext } from 'svelte'
  import { CATEGORY_COLORS, type CategoryId, type Node, type NodeId } from '../lib/model'

  type Data = { node: Node; inputs: CategoryId[]; isRoot: boolean }
  let { data }: NodeProps & { data: Data } = $props()
  const highlight = getContext<{ focus: NodeId; linked: NodeId[] }>('operad-highlight')

  const sort = $derived(data.node.kind === 'hole' ? data.node.expected : data.node.output)
</script>

<div class="operation">
  {#if !data.isRoot}
    <Handle type="source" id="out" position={Position.Top} style={`--port:${CATEGORY_COLORS[sort].glow}`} class="port-handle" />
  {/if}
  <OperadCard node={data.node} focused={highlight.focus === data.node.id} linked={highlight.linked.includes(data.node.id)} />
  {#each data.inputs as input, port (port)}
    <Handle
      type="target"
      id={`in-${port}`}
      position={Position.Bottom}
      class="port-handle"
      style={`left:${((port + 1) / (data.inputs.length + 1)) * 100}%;--port:${CATEGORY_COLORS[input].glow}`}
    />
    <span class="port-label" style:left={`${((port + 1) / (data.inputs.length + 1)) * 100}%`} style:--port={CATEGORY_COLORS[input].glow}>{input}</span>
  {/each}
</div>

<style>
  .operation { position: relative; width: 188px; }
  .operation :global(.card) { max-width: none; }
  .operation :global(.port-handle) {
    width: 16px; height: 16px; border: 2px solid var(--port); background: #0e1520;
  }
  .operation :global(.port-handle.connectingto.valid) { background: var(--port); }
  .port-label {
    position: absolute; bottom: -1.3rem; transform: translateX(-50%); padding: 0 .25rem;
    color: var(--port); font: 700 .52rem/1 ui-monospace, monospace; pointer-events: none;
  }
</style>
