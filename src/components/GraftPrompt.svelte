<script lang="ts">
  import { onMount } from 'svelte'
  import { fromPartialTerm } from '../lib/editor'
  import { GRAFT_MODES, graftCandidates, type GraftCandidate, type GraftMode } from '../lib/graft'
  import type { Workbench } from '../lib/builder'
  import { profileOf } from '../lib/languages'
  import type { CategoryId, NodeId } from '../lib/model'
  import type { Paradigms } from '../lib/morphology'
  import { sortColor } from '../lib/palette.svelte'
  import { parsePhraseInWorker } from '../lib/parser'

  /**
   * The keyboard graft prompt (i / g / e, and a for a new bench fragment).
   * Type words in any language — `_` marks a hole — and GF parses them at the
   * focused sort (concrete → abstract); or type an operation, a word, or a
   * signature (abstract, direct); or pick a bench fragment. ↑↓ (or Ctrl-j/k)
   * choose, Enter applies, Tab changes the verb, Esc closes.
   */
  let { mode = $bindable(), modes = GRAFT_MODES, sort, place, bench, paradigms, excluded, onApply, onClose }: {
    mode: GraftMode
    /** The verbs available here (extend needs a filled node; a new fragment only inserts or copies). */
    modes?: GraftMode[]
    /** The focused node's sort; undefined for a new fragment (anything goes). */
    sort: CategoryId | undefined
    /** Where the result goes, for the header: the sentence, a bench fragment, or a new fragment. */
    place: string
    bench: Workbench
    paradigms: Paradigms | undefined
    excluded?: NodeId
    onApply: (candidate: GraftCandidate, mode: GraftMode) => void
    onClose: () => void
  } = $props()

  let input = $state<HTMLInputElement>()
  let query = $state('')
  let selected = $state(0)
  let parsing = $state(false)
  let parsed = $state<{ expression: ReturnType<typeof fromPartialTerm>; text: string; language: string; via: string[] }[]>([])
  let serial = 0

  // Parse what is typed, debounced, in the worker; only the latest answer counts.
  $effect(() => {
    const text = query.trim()
    const target = sort
    const current = ++serial
    parsed = []
    if (!text || /->|→/.test(text)) { parsing = false; return }
    parsing = true
    const timer = setTimeout(() => {
      parsePhraseInWorker(text, target).then(readings => {
        if (current !== serial) return
        parsed = readings.map(reading => ({ expression: fromPartialTerm(reading.term), text, language: reading.language, via: reading.via }))
        parsing = false
      }).catch(() => { if (current === serial) parsing = false })
    }, 160)
    return () => clearTimeout(timer)
  })

  const candidates = $derived(graftCandidates({ mode, sort, query, parsed, bench, paradigms, excluded }).slice(0, 40))
  $effect(() => { if (selected >= candidates.length) selected = Math.max(0, candidates.length - 1) })

  const HINT: Record<GraftMode, string> = {
    insert: 'write here: words in any language (_ is a hole), an operation, a word, or a signature like -> AP',
    graft: 'bring a bench fragment here (or anything else that fits)',
    extend: 'build around this: an expression with a hole of its sort — this goes into it (_ and the woman)',
  }
  const code = (language: string | undefined) => language ? profileOf(language).code : ''

  function cycle(step: number) {
    const index = modes.indexOf(mode)
    mode = modes[(index + step + modes.length) % modes.length]
    selected = 0
  }

  function keydown(event: KeyboardEvent) {
    const down = event.key === 'ArrowDown' || (event.ctrlKey && (event.key === 'j' || event.key === 'n'))
    const up = event.key === 'ArrowUp' || (event.ctrlKey && (event.key === 'k' || event.key === 'p'))
    if (down || up) { event.preventDefault(); selected = Math.max(0, Math.min(candidates.length - 1, selected + (down ? 1 : -1))); return }
    if (event.key === 'Tab') { event.preventDefault(); cycle(event.shiftKey ? -1 : 1); return }
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key === 'Enter') {
      event.preventDefault()
      const choice = candidates[selected]
      if (choice) onApply(choice, mode)
    }
  }

  onMount(() => input?.focus())
</script>

<div class="graft" role="dialog" aria-label="Graft" style:--sort={sort ? sortColor(sort).abstract.accent : '#9fb3cc'}>
  <header>
    <div class="modes" role="tablist" aria-label="Graft verb">
      {#each modes as item}
        <button role="tab" aria-selected={item === mode} class:on={item === mode} onclick={() => { mode = item; input?.focus() }}>
          <kbd>{item === 'insert' ? 'i' : item === 'graft' ? 'g' : 'e'}</kbd>{item}
        </button>
      {/each}
    </div>
    <span class="where">{sort ? `⟦${sort}⟧` : 'any sort'} · {place}</span>
  </header>
  <input bind:this={input} bind:value={query} onkeydown={keydown} aria-label="Graft expression" spellcheck="false" autocomplete="off"
    oninput={() => selected = 0} placeholder={HINT[mode]} />
  <p class="status">
    {#if parsing}parsing…{:else if query.trim() && !parsed.length && !/->|→/.test(query)}no parse of “{query.trim()}” at {sort ?? 'any sort'} — showing operations and words{:else}{candidates.length} fit · ↑↓ choose · ↵ {mode} · ⇥ verb · esc{/if}
  </p>
  <ol class="results">
    {#each candidates as candidate, index (candidate.key)}
      <li>
        <button class:selected={index === selected} onmouseenter={() => selected = index} onclick={() => onApply(candidate, mode)}>
          <span class="source {candidate.source}">{candidate.source === 'parse' ? `parsed ${code(candidate.language)}` : candidate.source === 'bench' ? 'bench' : candidate.language ? `word ${code(candidate.language)}` : 'operation'}</span>
          <b>{candidate.title}</b>
          <code>{candidate.detail}</code>
        </button>
      </li>
    {:else}
      <li class="empty">{mode === 'graft' ? 'No bench fragment fits — x cuts a subtree to the bench, a adds a new one' : 'Nothing fits yet'}</li>
    {/each}
  </ol>
</div>

<style>
  .graft {
    position: fixed; z-index: 50; top: 4.2rem; left: 50%; transform: translateX(-50%); width: min(44rem, 94vw);
    display: grid; gap: .35rem; padding: .6rem; border: 1px solid #33455f; border-top: 3px solid var(--sort); border-radius: 6px;
    background: #0e1520f5; box-shadow: 0 18px 48px #0009; color: #dfe7f2; font: .74rem ui-monospace, monospace;
  }
  header { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
  .modes { display: flex; gap: .25rem; }
  .modes button { display: inline-flex; gap: .3rem; align-items: center; padding: .2rem .5rem; border: 1px solid #33455f; border-radius: 3px; background: #131c2a; color: #9fb3cc; font: inherit; cursor: pointer; }
  .modes button.on { border-color: var(--sort); color: #f4f7fb; }
  kbd { padding: 0 .25rem; border: 1px solid #44587a; border-radius: 2px; font-size: .62rem; color: var(--sort); }
  .where { color: var(--sort); font-weight: 700; }
  input { padding: .5rem .55rem; border: 1px solid #44587a; border-radius: 4px; background: #131c2a; color: #f4f7fb; font: .9rem ui-monospace, monospace; }
  input:focus { outline: 2px solid var(--sort); outline-offset: 1px; }
  .status { margin: 0; color: #7d8ea6; font-size: .64rem; }
  .results { margin: 0; padding: 0; list-style: none; display: grid; gap: .15rem; max-height: 50vh; overflow-y: auto; }
  .results button {
    width: 100%; display: grid; grid-template-columns: 6.2rem minmax(0, 1fr); column-gap: .5rem; row-gap: .1rem; align-items: baseline;
    padding: .3rem .45rem; border: 1px solid transparent; border-radius: 3px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
  }
  .results button.selected { border-color: var(--sort); background: #18243a; }
  .results b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .results code { grid-column: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8ea3bf; font-size: .64rem; }
  .source { grid-row: span 2; align-self: start; padding: .05rem .3rem; border-radius: 2px; font-size: .58rem; text-transform: uppercase; letter-spacing: .04em; color: #0e1520; background: #9fb3cc; text-align: center; }
  .source.parse { background: #84f5b9; }
  .source.bench { background: #f5c784; }
  .empty { padding: .4rem; color: #7d8ea6; }
</style>
