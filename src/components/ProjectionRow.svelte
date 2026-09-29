<script lang="ts">
  import { CATEGORY_COLORS, languageLabels, type CategoryId, type LinearizationProjection, type NodeId } from '../lib/model'

  let {
    projection, focus, linked = [], onFocus, onHover,
  }: {
    projection: LinearizationProjection
    focus: NodeId
    linked?: NodeId[]
    onFocus: (id: NodeId) => void
    onHover: (ids: NodeId[]) => void
  } = $props()

  const segmentStyle = (categories: CategoryId[]) => {
    const colors = categories.map(category => CATEGORY_COLORS[category])
    if (!colors.length) return ''
    if (colors.length === 1) return `--seg-ink:${colors[0].ink};--seg-wash:${colors[0].wash}`
    return `--seg-ink:${colors[0].ink};--seg-wash:linear-gradient(110deg, ${colors.map(color => color.wash).join(', ')})`
  }

  const isActive = (segmentId: string) =>
    (projection.nodeYields[focus] ?? []).includes(segmentId)
    || linked.some(id => (projection.nodeYields[id] ?? []).includes(segmentId))
</script>

<section class="projection" class:partial={projection.source === 'partial'}>
  <div class="language">
    <strong>{languageLabels[projection.language]}</strong>
    <span>{projection.source === 'gf' ? 'GF' : 'typed preview'}</span>
  </div>
  <div class="surface" aria-label={`${languageLabels[projection.language]} linearization`}>
    {#each projection.segments as segment (segment.id)}
      <button
        class="segment"
        class:active={isActive(segment.id)}
        class:zero={segment.role === 'zero'}
        class:hole={segment.role === 'hole'}
        style={segmentStyle(segment.categories)}
        onclick={() => segment.realizedBy[0] && onFocus(segment.realizedBy[0])}
        onmouseenter={() => onHover(segment.realizedBy)}
        onmouseleave={() => onHover([])}
        title={`${segment.categories.join(' + ')}${segment.featureValues.length ? ` · ${segment.featureValues.join(' + ')}` : ''}`}
      >
        <span>{segment.text}</span>
        {#if segment.featureValues.length}
          <small>{segment.featureValues.join('·')}</small>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .projection { display: grid; grid-template-columns: 7.3rem 1fr; gap: 1rem; align-items: center; padding: .78rem 0; border-top: 1px solid #e5ded2; }
  .language { display: flex; flex-direction: column; gap: .15rem; }
  .language strong { font-size: .82rem; }
  .language span { color: #8a8175; font: .62rem ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
  .partial .language span { color: #a24e2d; }
  .surface { display: flex; flex-wrap: wrap; align-items: baseline; gap: .32rem; min-height: 2.5rem; }
  .segment {
    position: relative; display: inline-flex; flex-direction: column; align-items: center; gap: .15rem;
    padding: .34rem .4rem .28rem; color: var(--seg-ink, #504a42); background: var(--seg-wash, #f2eee7);
    border: 1px solid color-mix(in srgb, var(--seg-ink, #777) 27%, transparent); border-radius: .42rem;
    font: 650 1.03rem/1.05 Georgia, serif; cursor: pointer;
  }
  .segment:hover, .segment.active { outline: 2px solid #25231f; outline-offset: 2px; }
  .segment small { color: inherit; font: 700 .49rem/1 ui-monospace, monospace; letter-spacing: .04em; }
  .segment.zero { border-style: dashed; opacity: .7; background: transparent; }
  .segment.hole { border-style: dashed; font-family: ui-monospace, monospace; font-size: .82rem; }
  @media (max-width: 650px) { .projection { grid-template-columns: 1fr; gap: .35rem; } }
</style>
