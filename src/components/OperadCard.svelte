<script lang="ts">
  import { constructorById, profile } from '../lib/grammar'
  import { CATEGORY_COLORS, type Node } from '../lib/model'

  /** One operation (or typed hole) of the operad, shared by the tree and flow views. */
  let { node, focused = false, linked = false }: { node: Node; focused?: boolean; linked?: boolean } = $props()

  const category = $derived(node.kind === 'hole' ? node.expected : node.output)
  const declaration = $derived(node.kind === 'apply' ? constructorById.get(node.constructor) : undefined)
</script>

<div class="card" class:focused class:linked class:hole={node.kind === 'hole'} style:--glow={CATEGORY_COLORS[category].glow}>
  {#if node.kind === 'hole'}
    <!-- A hole has no operation yet; its sort is all there is. -->
    <code class="operation">⟦{category}⟧</code>
    <span class="name">typed hole</span>
  {:else}
    <!-- The node is its operation (PredVP); the sort (Cl) is already the colour, so it stays small. -->
    <code class="operation">{node.constructor}</code>
    <span class="name">{declaration?.label ?? node.constructor}</span>
    {#if declaration}<span class="profile">{profile(declaration)}</span>{/if}
  {/if}
</div>

<style>
  /* Operad channel: a dark blueprint of typed operations. Hue = sort (cool half
     of the wheel); no words and no feature values ever appear here. */
  .card {
    display: grid; gap: .12rem; min-width: 9rem; max-width: 13rem; padding: .5rem .7rem; text-align: left;
    color: #dfe7f2; background: #131c2a;
    border: 1px solid color-mix(in srgb, var(--glow) 55%, transparent); border-left: 4px solid var(--glow); border-radius: 4px;
    box-shadow: 0 0 0 1px #0b111a, 0 0 18px -8px var(--glow);
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  }
  .card:hover { background: #172234; }
  .card.focused { outline: 2px solid #f4f7fb; outline-offset: 3px; }
  .card.linked:not(.focused) { outline: 2px dashed #f4f7fb; outline-offset: 3px; }
  .card.hole { border-style: dashed; background: #0e1520; }
  .operation { color: var(--glow); font: 800 .95rem/1.1 ui-monospace, monospace; }
  .name { color: #9fb0c6; font: 500 .7rem/1.2 ui-monospace, monospace; }
  .profile { margin-top: .2rem; padding-top: .2rem; border-top: 1px solid #22314a; color: #8a9bb2; font: .66rem/1.1 ui-monospace, monospace; }
</style>
