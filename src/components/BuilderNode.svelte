<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte'
  import OperadCard from './OperadCard.svelte'
  import { sortColor } from '../lib/palette.svelte'
  import type { CategoryId, Node } from '../lib/model'

  type Data = { node: Node; inputs: CategoryId[]; fragmentRoot: boolean; adoptable: boolean; onAdopt: () => void; onRemove: () => void }
  let { data }: NodeProps & { data: Data } = $props()
  const sort = $derived(data.node.kind === 'hole' ? data.node.expected : data.node.output)
</script>

<div class="operation" data-op={data.node.kind === 'hole' ? 'hole' : data.node.constructor}>
  <!-- Every node has an output (wires need it); only a fragment's root can start a new connection. -->
  <Handle type="source" id="out" position={Position.Top} class={data.fragmentRoot ? 'port-handle' : 'port-handle wired'}
    isConnectable={data.fragmentRoot} style={`--port:${sortColor(sort).abstract.accent}`} />
  {#if data.fragmentRoot}
    <div class="toolbar nodrag">
      {#if data.adoptable}<button class="adopt" onclick={data.onAdopt} title="Use this sentence">adopt ↵</button>{/if}
      <button onclick={data.onRemove} title="Remove this fragment">×</button>
    </div>
  {/if}
  <OperadCard node={data.node} />
  {#each data.inputs as input, port (port)}
    <Handle type="target" id={`in-${port}`} position={Position.Bottom} class="port-handle"
      style={`left:${((port + 1) / (data.inputs.length + 1)) * 100}%;--port:${sortColor(input).abstract.accent}`} />
    <span class="port-label" style:left={`${((port + 1) / (data.inputs.length + 1)) * 100}%`} style:--port={sortColor(input).abstract.accent}>{input}</span>
  {/each}
</div>

<style>
  .operation { position: relative; width: 188px; }
  .operation :global(.card) { max-width: none; }
  .operation :global(.port-handle) { width: 16px; height: 16px; border: 2px solid var(--port); background: #0e1520; }
  .operation :global(.port-handle.connectingto.valid) { background: var(--port); }
  .operation :global(.port-handle.wired) { width: 8px; height: 8px; border-width: 1px; background: var(--port); }
  .port-label { position: absolute; bottom: -1.3rem; transform: translateX(-50%); color: var(--port); font: 700 .52rem/1 ui-monospace, monospace; pointer-events: none; }
  .toolbar { position: absolute; top: -1.7rem; right: 0; display: flex; gap: .25rem; }
  .toolbar button { padding: .12rem .4rem; border: 1px solid #33455f; border-radius: 3px; background: #0e1520; color: #cfd8e4; font: 700 .6rem ui-monospace, monospace; cursor: pointer; }
  .toolbar .adopt { border-color: #84f5b9; color: #84f5b9; }
</style>
