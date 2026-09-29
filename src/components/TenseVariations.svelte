<script lang="ts">
  import type { GfRuntime } from '../lib/gf'
  import { producers } from '../lib/grammar'
  import { swapLeaf, toGfTerm } from '../lib/editor'
  import { languageLabels, type ApplyNode, type ConstructorId, type LinearizationProjection, type NodeId } from '../lib/model'
  import { segmentStyle } from '../lib/style'

  let {
    root, runtime, linked = [], onPick, onHover,
  }: {
    root: ApplyNode
    runtime: GfRuntime
    linked?: NodeId[]
    onPick: (tense: ConstructorId) => void
    onHover: (ids: NodeId[]) => void
  } = $props()

  type Row = { tense: ConstructorId; label: string; projections: LinearizationProjection[] }

  const tenses = producers('Temp')
  const slot = $derived(root.children[0] as ApplyNode)
  let rows = $state<Row[]>([])
  let error = $state('')

  // Same tree, one Temp leaf swapped per row. The slot keeps its node id, so
  // hovering a row's words lights up the same nodes in the tree.
  $effect(() => {
    const snapshot = $state.snapshot(root) as ApplyNode
    const slotId = snapshot.children[0].id
    let stale = false
    error = ''
    Promise.all(tenses.map(async tense => {
      const variant = swapLeaf(snapshot, slotId, tense.id)
      return { tense: tense.id, label: tense.label, projections: await runtime.linearize(toGfTerm(variant), variant, 0) }
    })).then(result => { if (!stale) rows = result })
      .catch(cause => { if (!stale) error = cause instanceof Error ? cause.message : 'Linearization failed' })
    return () => { stale = true }
  })

  const lit = (projection: LinearizationProjection, segmentId: string) =>
    linked.some(id => (projection.nodeYields[id] ?? []).includes(segmentId))
</script>

<section class="variations">
  <div class="heading">
    <div><span class="kicker">vary one leaf</span><h2>Tense variations</h2></div>
    <p>The same tree with only its <b>Temp</b> leaf swapped. Click a row to adopt that tense.</p>
  </div>
  {#if error}<p class="error">{error}</p>{/if}
  <div class="grid" role="table" aria-label="Tense variations">
    <div class="row head" role="row">
      <span role="columnheader">tense</span>
      {#each rows[0]?.projections ?? [] as projection (projection.language)}
        <span role="columnheader">{languageLabels[projection.language]}</span>
      {/each}
    </div>
    {#each rows as row (row.tense)}
      <button class="row" class:current={row.tense === slot.constructor} role="row" onclick={() => onPick(row.tense)}>
        <span class="tense" role="rowheader">{row.label}</span>
        {#each row.projections as projection (projection.language)}
          <span class="cell" role="cell">
            {#each projection.segments as segment (segment.id)}
              <span
                class="seg"
                class:zero={segment.role === 'zero'}
                class:lit={lit(projection, segment.id)}
                style={segmentStyle(segment.categories)}
                role="presentation"
                onmouseenter={() => onHover(segment.realizedBy)}
                onmouseleave={() => onHover([])}
                title={segment.featureValues.join(' + ')}
              >{segment.text}{#if segment.featureValues.length}<small>{segment.featureValues.join('·')}</small>{/if}</span>
            {/each}
          </span>
        {/each}
      </button>
    {/each}
  </div>
</section>

<style>
  .variations { padding: 1.2rem 1.55rem 1.7rem; border-top: 1px solid #d9d1c4; }
  .heading { display: flex; justify-content: space-between; align-items: start; gap: 1rem; margin-bottom: .7rem; }
  .heading h2 { margin: .1rem 0 0; font: 700 1.15rem Georgia, serif; }
  .heading p { max-width: 24rem; margin: 0; color: #6f675c; font-size: .78rem; }
  .grid { display: grid; gap: .2rem; overflow-x: auto; }
  .row {
    display: grid; grid-template-columns: 8.5rem repeat(3, minmax(12rem, 1fr)); gap: .8rem; align-items: center;
    padding: .38rem .5rem; text-align: left; font: inherit; color: inherit; background: transparent;
    border: 1px solid transparent; border-radius: .45rem; cursor: pointer;
  }
  .row:not(.head):hover { background: #f2eee7; }
  .row.current { background: #ebe7f8; border-color: #5b4a9e55; }
  .row.head { cursor: default; color: #8a8175; font: .62rem ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
  .tense { color: #5b4a9e; font: 650 .8rem ui-monospace, monospace; }
  .cell { display: flex; flex-wrap: wrap; gap: .2rem; align-items: baseline; }
  .seg {
    display: inline-flex; align-items: baseline; gap: .18rem; padding: .08rem .28rem; border-radius: .3rem;
    color: var(--seg-ink, #504a42); background: var(--seg-wash, #f2eee7); font: 600 .88rem Georgia, serif;
  }
  .seg small { font: 700 .45rem ui-monospace, monospace; }
  .seg.zero { opacity: .65; background: transparent; outline: 1px dashed currentColor; }
  .seg.lit { outline: 2px solid #25231f; outline-offset: 1px; }
  .error { color: #a22f2f; font-size: .8rem; }
</style>
