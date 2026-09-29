<script lang="ts">
  import { profileOf } from '../lib/languages'
  import Word from './Word.svelte'
  import { phraseBoxes } from '../lib/boxes'
  import { fitScale } from '../lib/layout'
  import { CATEGORY_COLORS, type LinearizationProjection, type Node, type NodeId } from '../lib/model'

  let {
    projection, root, focus, linked = [], pinned = [], orientation = 'row', scale, onFocus, onHover, onPin,
  }: {
    projection: LinearizationProjection
    root: Node
    focus: NodeId
    linked?: NodeId[]
    pinned?: string[]
    /** `row`: language name beside the sentence; `column`: above it, for languages side by side. */
    orientation?: 'row' | 'column'
    /** A shared scale (columns); without it the row measures itself and scales to fit its width. */
    scale?: number
    onFocus: (id: NodeId) => void
    onHover: (ids: NodeId[]) => void
    onPin: (features: string[]) => void
  } = $props()

  const boxes = $derived(phraseBoxes(root, projection))

  // Fit to width: natural (scale 1) width of the words vs the width available.
  let available = $state(0)
  let content: HTMLDivElement | undefined = $state()
  let natural = $state(0)
  $effect(() => {
    void projection
    if (!content) return
    const cells = [...content.querySelectorAll<HTMLElement>(':scope > .cell')]
    if (!cells.length) return
    const zoom = Number(getComputedStyle(content).zoom) || 1
    natural = (cells.at(-1)!.getBoundingClientRect().right - cells[0].getBoundingClientRect().left) / zoom
  })
  const zoom = $derived(scale ?? fitScale(natural, available))
  const highlighted = (id: NodeId) => id === focus || linked.includes(id)
  const wordActive = (segmentId: string) =>
    [focus, ...linked].some(id => (projection.nodeYields[id] ?? []).includes(segmentId))
</script>

<section class="algebra-row" class:partial={projection.source === 'partial'} class:column={orientation === 'column'}>
  <div class="language">
    <strong>{profileOf(projection.language).label}</strong>
    <span>{projection.source === 'gf' ? 'GF algebra' : 'typed preview'}</span>
  </div>
  <div class="fit" bind:clientWidth={available}>
  <div class="grid" bind:this={content} style:zoom={zoom} style:grid-template-columns={`repeat(${projection.segments.length}, max-content)`}>
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
        ><b>{box.category}</b><span class="name">{box.label}</span>{#if box.runs.length > 1}<i>{part + 1}/{box.runs.length}</i>{/if}</button>
      {/each}
    {/each}
  </div>
  </div>
</section>

<style>
  .algebra-row { display: grid; grid-template-columns: 7rem 1fr; gap: 1rem; padding: 1rem 0 1.1rem; border-top: 1px solid #e3dccf; }
  .language { display: flex; flex-direction: column; gap: .2rem; padding-top: .45rem; }
  .language strong { font: 600 1rem Georgia, serif; color: #26231e; }
  .language span { color: #8a8175; font: .58rem ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
  .partial .language span { color: #a24e2d; }
  .fit { min-width: 0; overflow-x: auto; }
  .grid { display: grid; width: max-content; max-width: none; column-gap: .4rem; row-gap: 3px; align-items: start; padding-bottom: .2rem; }
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
  .box b { flex: none; font-weight: 800; }
  /* Narrow boxes keep the sort and shorten the name (full name in the tooltip), never clipping both ends. */
  .box .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .box i { flex: none; font-style: normal; opacity: .65; }
  .box.split { border-style: dashed; }
  .box:hover, .box.lit { outline: 2px solid #1d1b18; outline-offset: 1px; }
  /* Narrow panes: the language name goes above the sentence, giving it the full width. */
  @container sentences (max-width: 760px) { .algebra-row:not(.column) { grid-template-columns: minmax(0, 1fr); gap: .35rem; } .algebra-row:not(.column) .language { flex-direction: row; align-items: baseline; gap: .5rem; padding-top: 0; } }
  .algebra-row.column { grid-template-columns: minmax(0, 1fr); gap: .45rem; padding: .6rem .2rem .9rem; border-top: 0; }
  .algebra-row.column .language { flex-direction: row; align-items: baseline; gap: .5rem; padding-top: 0; }
  @media (max-width: 650px) { .algebra-row { grid-template-columns: 1fr; gap: .35rem; } }
</style>
