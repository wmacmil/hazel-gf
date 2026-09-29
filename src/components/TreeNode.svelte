<script lang="ts">
  import { constructorById, profile } from '../lib/grammar'
  import { CATEGORY_COLORS, type Node, type NodeId } from '../lib/model'
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

  const category = $derived(node.kind === 'hole' ? node.expected : node.output)
  const color = $derived(CATEGORY_COLORS[category])
  const declaration = $derived(node.kind === 'apply' ? constructorById.get(node.constructor) : undefined)
</script>

<div class="branch">
  <button
    class="node"
    class:focused={node.id === focus}
    class:linked={linked.includes(node.id)}
    class:hole={node.kind === 'hole'}
    style:--glow={color.glow}
    onclick={() => onFocus(node.id)}
    onmouseenter={() => onHover([node.id])}
    onmouseleave={() => onHover([])}
    aria-pressed={node.id === focus}
  >
    <span class="output">{category}</span>
    {#if node.kind === 'hole'}
      <span class="hole-mark">?</span>
      <span class="name">typed hole</span>
    {:else}
      <span class="name">{declaration?.label ?? node.constructor}</span>
      <code>{node.constructor}</code>
      {#if declaration}<span class="profile">{profile(declaration)}</span>{/if}
    {/if}
  </button>

  {#if node.kind === 'apply' && node.children.length}
    <div class="children">
      {#each node.children as child, index (child.id)}
        <div class="child">
          <span class="port" style:--port={CATEGORY_COLORS[declaration?.inputs[index] ?? category].glow}>
            {declaration?.inputs[index]}
          </span>
          <TreeNode node={child} {focus} {linked} {onFocus} {onHover} />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Operad channel: a dark blueprint of typed operations. Hue = sort (cool half
     of the wheel); no words and no feature values ever appear here. */
  .branch { display: flex; flex-direction: column; align-items: center; min-width: max-content; }
  .node {
    position: relative; display: grid; grid-template-columns: auto 1fr; gap: .1rem .5rem;
    min-width: 9rem; max-width: 13rem; padding: .5rem .62rem; text-align: left; cursor: pointer;
    color: #dfe7f2; background: #131c2a;
    border: 1px solid color-mix(in srgb, var(--glow) 55%, transparent); border-radius: 4px;
    box-shadow: 0 0 0 1px #0b111a, 0 0 18px -8px var(--glow);
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  }
  .node:hover { background: #172234; }
  .node.focused { outline: 2px solid #f4f7fb; outline-offset: 3px; }
  .node.linked:not(.focused) { outline: 2px dashed #f4f7fb; outline-offset: 3px; }
  .node.hole { border-style: dashed; background: transparent; }
  .output {
    grid-row: 1 / span 2; align-self: center; min-width: 2.1rem; padding: .24rem .3rem;
    border-radius: 2px; color: #0b111a; background: var(--glow);
    font: 800 .68rem/1 ui-monospace, monospace; text-align: center;
  }
  .name { color: #9fb0c6; font: 500 .62rem/1.2 ui-monospace, monospace; }
  code { color: var(--glow); font: 700 .74rem/1.15 ui-monospace, monospace; grid-row: 1; grid-column: 2; }
  .name { grid-row: 2; grid-column: 2; }
  .profile { grid-column: 1 / -1; margin-top: .22rem; padding-top: .22rem; border-top: 1px solid #22314a; color: #7d8ea6; font: .58rem/1.1 ui-monospace, monospace; }
  .hole-mark { position: absolute; top: .3rem; right: .45rem; color: var(--glow); font-weight: 800; }
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
