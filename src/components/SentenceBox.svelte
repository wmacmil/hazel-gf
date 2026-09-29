<script lang="ts">
  import { fromGfTerm } from '../lib/editor'
  import type { GfRuntime } from '../lib/gf'
  import { LANGUAGES, profileOf } from '../lib/languages'
  import { parseInWorker } from '../lib/parser'
  import { distinguishing, type ParseResult } from '../lib/parsing'
  import { constructorById } from '../lib/grammar'

  /** Algebra → operad: type a sentence in any language and GF parses it into trees. */
  let { runtime, onLoad }: { runtime: GfRuntime; onLoad: (term: string) => void } = $props()

  let language = $state(LANGUAGES[0].id)
  let text = $state('')
  let result = $state<ParseResult>()
  let busy = $state(false)
  let error = $state('')
  /** Each reading's rendering in the other languages, where an ambiguity usually shows. */
  let glosses = $state<Record<string, string[]>>({})
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest = 0

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(parse, 350)
  }

  async function parse() {
    const request = ++latest
    const input = text.trim()
    if (!input) { result = undefined; return }
    busy = true
    try {
      const parsed = await parseInWorker(language, input)
      if (request !== latest) return
      result = parsed
      error = ''
      glosses = {}
      if (parsed.status === 'parsed' && parsed.terms.length > 1) {
        for (const term of parsed.terms) {
          const projections = await runtime.linearize(term, fromGfTerm(term), 0)
          if (request !== latest) return
          glosses = { ...glosses, [term]: projections.filter(item => item.language !== language).map(item => item.text) }
        }
      }
    } catch (cause) {
      if (request === latest) error = cause instanceof Error ? cause.message : 'Parse failed'
    } finally {
      if (request === latest) busy = false
    }
  }

  function load(term: string) {
    onLoad(term)
    text = ''
    result = undefined
  }

  function continueWith(word: string) {
    if (result?.status !== 'failed') return
    text = [...result.read.slice(0, result.consumed), word].join(' ') + ' '
    schedule()
  }
</script>

<div class="sentence-box">
  <div class="entry">
    <select bind:value={language} onchange={schedule} aria-label="Language to parse">
      {#each LANGUAGES as profile}<option value={profile.id}>{profile.label}</option>{/each}
    </select>
    <input
      bind:value={text}
      oninput={schedule}
      onkeydown={event => { if (event.key === 'Enter' && result?.status === 'parsed' && result.terms.length === 1) load(result.terms[0]) }}
      placeholder="write a sentence to parse… (e.g. der Mann schläft im Haus)"
      aria-label="Sentence to parse"
    />
    <span class="state">{busy ? 'parsing…' : result?.status === 'parsed' ? `${result.terms.length} reading${result.terms.length === 1 ? '' : 's'}` : ''}</span>
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  {#if result?.status === 'parsed'}
    {#if result.read.join(' ') !== text.trim().replace(/[.,!?;:]+$/, '')}
      <p class="note">read as “{result.read.join(' ')}”</p>
    {/if}
    <div class="readings">
      {#each result.terms as term, index (term)}
        <button class="reading" onclick={() => load(term)}>
          <span class="rank">{result.terms.length > 1 ? `reading ${index + 1}` : 'load'} ↵</span>
          {#if result.terms.length > 1}
            <span class="distinct">only this reading: {distinguishing(result.terms)[term].map(name => `${constructorById.get(name)?.label ?? name} (${name})`).join(', ')}</span>
          {/if}
          {#if glosses[term]}<span class="gloss">{glosses[term].join(' · ')}</span>{/if}
          <code>{term}</code>
        </button>
      {/each}
    </div>
  {:else if result?.status === 'failed'}
    <p class="marked" aria-label="Where the parse stopped">
      {#each result.read as token, index}
        <span class:ok={index < result.consumed} class:stop={index === result.consumed} class:unknown={result.unknown.includes(token)}>{token}</span>{' '}
      {/each}
      {#if result.consumed >= result.read.length}<span class="stop gap">…</span>{/if}
    </p>
    <p class="note">
      {#if result.unknown.length}not in the {profileOf(language).label} lexicon: {result.unknown.join(', ')}. {/if}
      {result.consumed >= result.read.length ? 'incomplete — ' : ''}{result.expected.length ? 'GF would accept next:' : 'nothing can continue here.'}
    </p>
    <div class="expected">
      {#each result.expected.slice(0, 24) as word}<button onclick={() => continueWith(word)}>{word}</button>{/each}
    </div>
  {/if}
</div>

<style>
  .sentence-box { display: grid; gap: .4rem; }
  .entry { display: grid; grid-template-columns: auto 1fr auto; gap: .4rem; align-items: center; }
  select, input { padding: .45rem .5rem; border: 1px solid #d1c8ba; border-radius: .35rem; background: #fff; font: 500 .9rem Georgia, serif; }
  input:focus { outline: 2px solid #1d1b18; outline-offset: 1px; }
  .state { color: #8a8175; font: .6rem ui-monospace, monospace; min-width: 5rem; }
  .note { margin: 0; color: #7c7367; font: .64rem ui-monospace, monospace; }
  .error { margin: 0; color: #a22f2f; font-size: .72rem; }
  .readings { display: grid; gap: .3rem; }
  .reading { display: grid; gap: .15rem; padding: .45rem .55rem; text-align: left; border: 1px solid #d8cfbf; border-radius: .4rem; background: #fffdf8; cursor: pointer; }
  .reading:hover { border-color: #1d1b18; }
  .rank { font: 700 .6rem ui-monospace, monospace; color: #5a3e8c; }
  .distinct { font: 600 .66rem ui-monospace, monospace; color: #1f5f73; }
  .gloss { font: 500 .85rem Georgia, serif; color: #26231e; }
  .reading code { color: #7c7367; font: .56rem ui-monospace, monospace; }
  .marked { margin: 0; font: 500 1rem Georgia, serif; }
  .marked .ok { color: #26231e; }
  .marked .stop { color: #a22f2f; text-decoration: underline wavy #a22f2f; text-underline-offset: .2em; }
  .marked .unknown { background: #fccfd2; border-radius: .2rem; }
  .marked span:not(.ok):not(.stop) { color: #a09686; }
  .expected { display: flex; flex-wrap: wrap; gap: .25rem; }
  .expected button { padding: .15rem .4rem; border: 1px solid #d1c8ba; border-radius: 999px; background: #fffdf8; font: 500 .78rem Georgia, serif; cursor: pointer; }
</style>
