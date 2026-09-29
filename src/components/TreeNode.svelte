<script lang="ts">
  import { constructorById } from '../lib/grammar'
  import { outputOf } from '../lib/editor'
  import type { Node, NodeId } from '../lib/model'
  import { sortColor } from '../lib/palette.svelte'
  import OperadCard from './OperadCard.svelte'
  import TreeNode from './TreeNode.svelte'

  let {
    node, focus, linked = [], onFocus, onHover,
  }: {
    node: Node
    focus: NodeId
    linked?: NodeId[]
    onFocus: (id: NodeId) => void
    onHover: (ids: NodeId[]) => void
  } = $props()

  const declaration = $derived(node.kind === 'apply' ? constructorById.get(node.constructor) : undefined)
</script>

<div class="branch">
  <button
    class="node"
    onclick={() => onFocus(node.id)}
    onmouseenter={() => onHover([node.id])}
    onmouseleave={() => onHover([])}
    aria-pressed={node.id === focus}
  >
    <OperadCard {node} focused={node.id === focus} linked={linked.includes(node.id)} />
  </button>

  {#if node.kind === 'apply' && node.children.length}
    <div class="children">
      {#each node.children as child, index (child.id)}
        <div class="child">
          <span class="port" style:--port={sortColor(declaration?.inputs[index] ?? outputOf(child)).abstract.accent}>
            {declaration?.inputs[index]}
          </span>
          <TreeNode node={child} {focus} {linked} {onFocus} {onHover} />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .branch { display: flex; flex-direction: column; align-items: center; min-width: max-content; }
  .node { padding: 0; border: 0; background: none; cursor: pointer; }
  .children { position: relative; display: flex; gap: 1.1rem; padding-top: 1.65rem; }
  .children::before { content: ''; position: absolute; top: .72rem; left: 10%; right: 10%; border-top: 1px solid #33455f; }
  .child { position: relative; display: flex; flex-direction: column; align-items: center; }
  .child::before { content: ''; height: .75rem; border-left: 1px solid #33455f; position: absolute; top: -1.65rem; }
  .port {
    margin: -1.45rem 0 .48rem; z-index: 1; padding: .1rem .3rem; border-radius: 999px;
    color: var(--port); background: #0e1520; border: 1px solid color-mix(in srgb, var(--port) 60%, transparent);
    font: 700 .56rem/1 ui-monospace, monospace;
  }
</style>
