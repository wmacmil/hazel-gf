<script lang="ts">
  import type { GfRuntime } from '../lib/gf'
  import { producers } from '../lib/grammar'
  import { swapLeaf, toGfTerm } from '../lib/editor'
  import { languageLabels, type ApplyNode, type ConstructorId, type LinearizationProjection, type NodeId } from '../lib/model'
  import Word from './Word.svelte'
  import { allowedTenses } from '../lib/constraints'

  let {
    root, runtime, linked = [], pinned = [], onPick, onHover, onPin,
  }: {
    root: ApplyNode
    runtime: GfRuntime
    linked?: NodeId[]
    pinned?: string[]
    onPick: (tense: ConstructorId) => void
    onHover: (ids: NodeId[]) => void
    onPin: (features: string[]) => void
  } = $props()

  const allowed = $derived(new Set(allowedTenses(pinned).map(tense => tense.id)))

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
    <p>The same tree with only its <b>Temp</b> leaf swapped. Click a tense to adopt it; click a morpheme to pin its feature — rows it rules out fade.</p>
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
      <div class="row" class:current={row.tense === slot.constructor} class:excluded={!allowed.has(row.tense)} role="row">
        <button class="tense" role="rowheader" onclick={() => onPick(row.tense)} title="adopt this tense">{row.label} ↵</button>
        {#each row.projections as projection (projection.language)}
          <span class="cell" role="cell">
            {#each projection.segments as segment (segment.id)}
              <Word {segment} compact {pinned} active={lit(projection, segment.id)} {onHover} {onPin} />
            {/each}
          </span>
        {/each}
      </div>
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
  .row.excluded { opacity: .28; }
  .row.current { background: #ebe7f8; border-color: #5b4a9e55; }
  .row.head { cursor: default; color: #8a8175; font: .62rem ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
  .tense { padding: .2rem .3rem; border: 0; border-radius: .3rem; background: transparent; color: #5a3e8c; font: 650 .74rem ui-monospace, monospace; text-align: left; cursor: pointer; }
  .tense:hover { background: #ebe6f6; }
  .cell { display: flex; flex-wrap: wrap; gap: .25rem; align-items: end; }
  .error { color: #a22f2f; font-size: .8rem; }
</style>
