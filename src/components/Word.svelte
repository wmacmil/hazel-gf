<script lang="ts">
  import type { LinearizedSegment, Morpheme, NodeId } from '../lib/model'
  import { morphemeStyle } from '../lib/palette.svelte'

  let {
    segment, active = false, compact = false, pinned = [], onHover, onFocus, onPin,
  }: {
    segment: LinearizedSegment
    active?: boolean
    compact?: boolean
    pinned?: string[]
    onHover: (ids: NodeId[]) => void
    onFocus?: (id: NodeId) => void
    onPin?: (features: string[]) => void
  } = $props()

  const pieces = $derived<Morpheme[]>(segment.morphemes ?? [
    { text: segment.text, role: segment.role === 'hole' ? 'function' : 'stem', features: segment.featureValues, realizedBy: segment.realizedBy },
  ])
  const isPinned = (piece: Morpheme) => piece.features.some(feature => pinned.includes(feature))
</script>

<span class="word" class:active class:compact class:bound={segment.bound} class:hole={segment.role === 'hole'}>
  {#each pieces as piece, index (index)}
    <button
      type="button"
      class="piece {piece.role}"
      class:pinned={isPinned(piece)}
      style={morphemeStyle(piece.features, segment.categories[0], piece.role)}
      title={piece.features.length ? piece.features.join(' + ') : piece.role}
      onmouseenter={() => onHover(piece.realizedBy)}
      onmouseleave={() => onHover([])}
      onclick={() => piece.features.length && onPin ? onPin(piece.features) : onFocus?.(piece.realizedBy[0])}
    >
      <span class="text">{piece.role === 'zero' ? '∅' : piece.text}</span>
      <!-- Always present (empty when featureless) so every word's text sits on one baseline. -->
      <small aria-hidden={!piece.features.length}>{piece.features.length ? piece.features.join('·') : '\u00a0'}</small>
    </button>
  {/each}
</span>

<style>
  /* Algebra channel: paper and serif type. Only feature (warm) colors appear
     here; operad (sort) colors reach the paper solely as phrase-box hairlines. */
  .word {
    display: inline-flex; align-items: stretch; gap: 1px; padding: 2px;
    border: 1px solid #d8cfbf; border-radius: .4rem; background: #fffdf8;
  }
  .word.active { outline: 2px solid #1d1b18; outline-offset: 2px; }
  /* Bound to the previous word (GF BIND: l'·homme): flush against it, joined by a dotted seam. */
  .word.bound { margin-left: calc(-1 * var(--word-gap, .25rem) - 1px); border-left: 1px dotted #b9ae9c; border-top-left-radius: 0; border-bottom-left-radius: 0; }
  .word.hole { border-style: dashed; }
  .piece {
    display: inline-flex; flex-direction: column; align-items: center; justify-content: start; gap: .12rem;
    padding: .2rem .24rem .16rem; border: 0; border-radius: .28rem; cursor: pointer;
    color: var(--m-ink, #26231e); background: var(--m-wash, transparent);
    font: 600 1.08rem/1 Georgia, 'Iowan Old Style', serif;
  }
  .piece:hover { box-shadow: inset 0 0 0 1.5px currentColor; }
  .piece.stem, .piece.function { color: #26231e; }
  .piece.function { background: var(--m-wash, transparent); color: var(--m-ink, #26231e); }
  .piece.changed-stem .text { text-decoration: underline wavy color-mix(in srgb, var(--m-ink, #26231e) 70%, transparent); text-underline-offset: .22em; }
  .piece.zero { min-width: 1.2rem; background: transparent; border: 1px dashed var(--m-ink, #8a8175); color: var(--m-ink, #8a8175); font-weight: 400; }
  .piece.pinned { box-shadow: inset 0 0 0 2px #1d1b18; }
  .piece small { min-height: 1em; font: 700 .46rem/1 ui-monospace, monospace; letter-spacing: .03em; color: var(--m-ink, #6f675c); }
  .compact .piece { padding: .1rem .16rem; font-size: .86rem; }
  .compact .piece small { font-size: .4rem; }
</style>
