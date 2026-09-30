<script lang="ts">
  import { profile } from '../lib/grammar'
  import { profileOf } from '../lib/languages'
  import type { Paradigms } from '../lib/morphology'
  import type { CategoryId } from '../lib/model'
  import { sortColor } from '../lib/palette.svelte'
  import { searchExpressions, type SearchResult } from '../lib/search'

  /**
   * Find an expression for the focused hole by name, by a word in any language,
   * or by signature (`NP -> VP`, `-> AP`). Results are whole typed expressions
   * whose output is the hole's sort; their other arguments stay holes.
   */
  let { target, paradigms, onInsert, input = $bindable() }: {
    target: CategoryId
    paradigms: Paradigms | undefined
    onInsert: (result: SearchResult) => void
    input?: HTMLInputElement
  } = $props()

  let query = $state('')
  let selected = $state(0)
  const results = $derived(searchExpressions(query, target, paradigms))
  $effect(() => { void query; selected = 0 })

  function choose(result: SearchResult | undefined) {
    if (!result) return
    onInsert(result)
    query = ''
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); choose(results[selected]) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); selected = Math.min(results.length - 1, selected + 1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(0, selected - 1) }
    else if (event.key === 'Escape') { query = ''; input?.blur() }
  }
</script>

<div class="type-search">
  <span class="kicker">find an expression of type <b style:color={sortColor(target).concrete.ink}>{target}</b></span>
  <input bind:this={input} bind:value={query} onkeydown={keydown} aria-label="Find an expression"
    placeholder="name, word (any language), or NP -> VP" />
  {#if query.trim() && !results.length}
    <p class="none">nothing of type {target} matches “{query.trim()}”.</p>
  {/if}
  <div class="results" role="listbox" aria-label="Expressions">
    {#each results as result, index (result.path.join('>') + (result.word?.form ?? ''))}
      <button class="result" class:selected={index === selected} role="option" aria-selected={index === selected}
        onclick={() => choose(result)} onmouseenter={() => selected = index}>
        <span class="head">
          {#if result.word}<strong>{result.word.form}</strong><em>{profileOf(result.word.language).label}</em>{:else}<strong>{result.operation.id}</strong><em>{result.operation.label}</em>{/if}
        </span>
        <code>{result.path.join(' › ')}</code>
        <span class="meta">
          {profile(result.operation)} · {result.obligations} obligation{result.obligations === 1 ? '' : 's'}
          {#if result.word?.pins.length}· pins {result.word.pins.join('·')}{/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .type-search { display: grid; gap: .4rem; margin: 0 0 1rem; padding: .7rem; border: 1px dashed #cfc6b8; border-radius: .55rem; background: #fffdf8; }
  .type-search .kicker { margin: 0; }
  input { padding: .45rem .5rem; border: 1px solid #d1c8ba; border-radius: .35rem; background: #fff; font: 500 .82rem ui-monospace, monospace; }
  input:focus { outline: 2px solid #1d1b18; outline-offset: 1px; }
  .none { margin: 0; color: #a0522d; font: .62rem ui-monospace, monospace; }
  .results { display: grid; gap: .28rem; max-height: 22rem; overflow-y: auto; }
  .result { display: grid; gap: .1rem; padding: .42rem .5rem; text-align: left; border: 1px solid #e0d8cb; border-radius: .4rem; background: #fbf8f1; cursor: pointer; }
  .result.selected { border-color: #1d1b18; background: #fffdf8; }
  .head { display: flex; align-items: baseline; gap: .4rem; }
  .head strong { font: 700 .86rem ui-monospace, monospace; }
  .head em { color: #8a8175; font: italic .66rem Georgia, serif; }
  .result code { color: #5d554b; font: .6rem ui-monospace, monospace; }
  .meta { color: #8a8175; font: .58rem ui-monospace, monospace; }
</style>
