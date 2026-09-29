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
    style:--node-ink={color.ink}
    style:--node-wash={color.wash}
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
          <span class="port" style:--port={CATEGORY_COLORS[declaration?.inputs[index] ?? category].ink}>
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
  .node {
    position: relative; display: grid; grid-template-columns: auto 1fr; gap: .12rem .48rem;
    min-width: 9.5rem; max-width: 14rem; padding: .58rem .68rem; text-align: left;
    color: #25231f; background: color-mix(in srgb, var(--node-wash) 72%, #fff);
    border: 1px solid color-mix(in srgb, var(--node-ink) 42%, #b8b0a1);
    border-radius: .72rem; cursor: pointer; box-shadow: 0 2px 9px rgb(48 42 31 / 7%);
    transition: transform 100ms ease, box-shadow 100ms ease, outline-color 100ms ease;
  }
  .node:hover { transform: translateY(-1px); box-shadow: 0 4px 13px rgb(48 42 31 / 12%); }
  .node.focused { outline: 3px solid #20201e; outline-offset: 3px; }
  .node.linked:not(.focused) { outline: 3px solid var(--node-ink); outline-offset: 3px; }
  .node.hole { border-style: dashed; background: #fffdf7; }
  .output {
    grid-row: 1 / span 2; align-self: center; min-width: 2rem; padding: .22rem .3rem;
    border-radius: .38rem; color: var(--node-ink); background: var(--node-wash);
    font: 750 .72rem/1 ui-monospace, monospace; text-align: center;
  }
  .name { font: 650 .78rem/1.15 system-ui, sans-serif; }
  code, .profile { color: #696155; font: .62rem/1.1 ui-monospace, monospace; }
  .profile { grid-column: 2; margin-top: .12rem; }
  .hole-mark { position: absolute; top: .32rem; right: .48rem; color: var(--node-ink); font-weight: 800; }
  .children { position: relative; display: flex; gap: 1.15rem; padding-top: 1.65rem; }
  .children::before { content: ''; position: absolute; top: .72rem; left: 10%; right: 10%; border-top: 1px solid #c9c0b2; }
  .child { position: relative; display: flex; flex-direction: column; align-items: center; }
  .child::before { content: ''; height: .75rem; border-left: 1px solid #c9c0b2; position: absolute; top: -1.65rem; }
  .port {
    margin: -1.45rem 0 .48rem; z-index: 1; padding: .12rem .28rem; border-radius: .25rem;
    color: var(--port); background: #fbf8f0; border: 1px solid color-mix(in srgb, var(--port) 35%, #ddd);
    font: 700 .58rem/1 ui-monospace, monospace;
  }
</style>
