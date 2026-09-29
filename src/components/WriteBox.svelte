<script lang="ts">
  import { LANGUAGES } from '../lib/languages'
  import { preorder } from '../lib/editor'
  import type { Paradigms } from '../lib/morphology'
  import type { CategoryId } from '../lib/model'
  import { candidates, formIndex, type Candidate } from '../lib/writing'

  /** Hazel-style text entry: write a word in any language into the focused hole of sort `expected`. */
  let { expected, paradigms, onWrite }: {
    expected: CategoryId
    paradigms: Paradigms | undefined
    onWrite: (candidate: Candidate) => void
  } = $props()

  let language = $state(LANGUAGES[0].id)
  let text = $state('')
  const index = $derived(paradigms ? formIndex(paradigms, language) : undefined)
  const found = $derived(index ? candidates(index, expected, text) : [])
  const obligations = (candidate: Candidate) => preorder(candidate.subtree).filter(node => node.kind === 'hole').length

  function write(candidate: Candidate | undefined) {
    if (!candidate) return
    onWrite(candidate)
    text = ''
  }
</script>

<div class="write">
  <span class="kicker">write into ⟦{expected}⟧</span>
  <div class="entry">
    <select bind:value={language} aria-label="Language to write in">
      {#each LANGUAGES as profile}<option value={profile.id}>{profile.label}</option>{/each}
    </select>
    <input
      bind:value={text}
      placeholder={paradigms ? 'type a word…' : 'loading lexicon…'}
      disabled={!paradigms}
      aria-label="Word to write"
      onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); write(found[0]) } }}
    />
  </div>
  {#if text.trim() && !found.length}
    <p class="none">“{text.trim()}” is not in the lexicon, or cannot fill a {expected}.</p>
  {/if}
  <div class="found">
    {#each found as candidate, rank (candidate.leaf + candidate.form)}
      <button class="candidate" class:first={rank === 0} onclick={() => write(candidate)}>
        <strong>{candidate.form}</strong>
        <code>{candidate.path.join(' › ')}</code>
        <span>
          {obligations(candidate)} obligation{obligations(candidate) === 1 ? '' : 's'}
          {#if candidate.pins.length}· pins {candidate.pins.join('·')}{/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .write { display: grid; gap: .45rem; margin: 0 0 1rem; padding: .7rem; border: 1px dashed #cfc6b8; border-radius: .55rem; background: #fffdf8; }
  .write .kicker { margin: 0; }
  .entry { display: grid; grid-template-columns: auto 1fr; gap: .35rem; }
  select, input { padding: .4rem .45rem; border: 1px solid #d1c8ba; border-radius: .35rem; background: #fff; font: 500 .8rem Georgia, serif; }
  input:focus { outline: 2px solid #1d1b18; outline-offset: 1px; }
  .none { margin: 0; color: #a0522d; font: .62rem ui-monospace, monospace; }
  .found { display: grid; gap: .3rem; }
  .candidate { display: grid; gap: .12rem; padding: .45rem .5rem; text-align: left; border: 1px solid #e0d8cb; border-radius: .4rem; background: #fbf8f1; cursor: pointer; }
  .candidate.first { border-color: #1d1b18; }
  .candidate strong { font: 650 .92rem Georgia, serif; }
  .candidate code { color: #5d554b; font: .6rem ui-monospace, monospace; }
  .candidate span { color: #8a8175; font: .58rem ui-monospace, monospace; }
</style>
