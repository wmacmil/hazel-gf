<script lang="ts">
  import { profileOf } from '../lib/languages'
  import Word from './Word.svelte'
  import { phraseBoxes } from '../lib/boxes'
  import { CATEGORY_COLORS, type LinearizationProjection, type Node, type NodeId } from '../lib/model'

  let {
    projection, root, focus, linked = [], pinned = [], onFocus, onHover, onPin,
  }: {
    projection: LinearizationProjection
    root: Node
    focus: NodeId
    linked?: NodeId[]
    pinned?: string[]
    onFocus: (id: NodeId) => void
    onHover: (ids: NodeId[]) => void
    onPin: (features: string[]) => void
  } = $props()

  const boxes = $derived(phraseBoxes(root, projection))
  const highlighted = (id: NodeId) => id === focus || linked.includes(id)
  const wordActive = (segmentId: string) =>
    [focus, ...linked].some(id => (projection.nodeYields[id] ?? []).includes(segmentId))
</script>

<section class="algebra-row" class:partial={projection.source === 'partial'}>
  <div class="language">
    <strong>{profileOf(projection.language).label}</strong>
    <span>{projection.source === 'gf' ? 'GF algebra' : 'typed preview'}</span>
  </div>
  <div class="grid" style:grid-template-columns={`repeat(${projection.segments.length}, max-content)`}>
    {#each projection.segments as segment, index (segment.id)}
      <div class="cell" style:grid-column={index + 1}>
        <Word {segment} {pinned} active={wordActive(segment.id)} {onHover} {onFocus} {onPin} />
      </div>
    {/each}
    {#each boxes as box (box.node)}
      {#each box.runs as [start, end], part (part)}
        <button
          type="button"
          class="box"
          class:split={box.runs.length > 1}
          class:lit={highlighted(box.node)}
          style:grid-column={`${start + 1} / ${end + 2}`}
          style:grid-row={box.row + 2}
          style:--sort={CATEGORY_COLORS[box.category].ink}
          style:--sort-wash={CATEGORY_COLORS[box.category].wash}
          title={`${box.category} · ${box.label}${box.runs.length > 1 ? ` · part ${part + 1}/${box.runs.length}` : ''}`}
          onclick={() => onFocus(box.node)}
          onmouseenter={() => onHover([box.node])}
          onmouseleave={() => onHover([])}
        ><b>{box.category}</b> {box.label}{#if box.runs.length > 1}<i>{part + 1}/{box.runs.length}</i>{/if}</button>
      {/each}
    {/each}
  </div>
</section>

<style>
  .algebra-row { display: grid; grid-template-columns: 7rem 1fr; gap: 1rem; padding: 1rem 0 1.1rem; border-top: 1px solid #e3dccf; }
  .language { display: flex; flex-direction: column; gap: .2rem; padding-top: .45rem; }
  .language strong { font: 600 1rem Georgia, serif; color: #26231e; }
  .language span { color: #8a8175; font: .58rem ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
  .partial .language span { color: #a24e2d; }
  .grid { display: grid; column-gap: .4rem; row-gap: 3px; align-items: start; overflow-x: auto; padding-bottom: .2rem; }
  .cell { grid-row: 1; margin-bottom: .45rem; }
  /* The operad's image on the paper: hairline boxes in the sort's (cool) hue. */
  .box {
    /* contain: inline-size keeps labels from widening the word columns. */
    display: flex; align-items: center; justify-content: center; gap: .3rem; min-width: 0; overflow: hidden; contain: inline-size;
    padding: .12rem .35rem; white-space: nowrap; cursor: pointer;
    color: var(--sort); background: color-mix(in srgb, var(--sort-wash) 55%, transparent);
    border: 1px solid color-mix(in srgb, var(--sort) 55%, transparent); border-radius: 3px;
    font: 500 .56rem/1.3 ui-monospace, monospace;
  }
  .box b { font-weight: 800; }
  .box i { font-style: normal; opacity: .65; }
  .box.split { border-style: dashed; }
  .box:hover, .box.lit { outline: 2px solid #1d1b18; outline-offset: 1px; }
  @media (max-width: 650px) { .algebra-row { grid-template-columns: 1fr; gap: .35rem; } }
</style>
