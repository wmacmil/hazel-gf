<script lang="ts">
  import { onMount } from 'svelte'
  import TreeNode from './components/TreeNode.svelte'
  import AlgebraRow from './components/AlgebraRow.svelte'
  import TenseVariations from './components/TenseVariations.svelte'
  import OperadFlow from './components/OperadFlow.svelte'
  import { createRuntime, loadParadigms } from './lib/gf'
  import WriteBox from './components/WriteBox.svelte'
  import type { Paradigms } from './lib/morphology'
  import type { Candidate } from './lib/writing'
  import { producers, profile, wrappers } from './lib/grammar'
  import {
    clearFocused, fillFocused, findNode, isComplete, moveFocus, newDocument, outputOf,
    insertAt, moveSubtree, swapLeaf, toGfTerm, validateDocument, wrapFocused,
  } from './lib/editor'
  import { agreementExample, exampleDocument, modifierExample, prepositionExample } from './lib/examples'
  import { partialProjections } from './lib/projection'
  import { allowedTenses, pinnable, togglePins } from './lib/constraints'
  import { CATEGORY_COLORS, type ConstructorId, type EditorDocument, type LinearizationProjection, type NodeId } from './lib/model'

  const STORAGE_KEY = 'hazel-gf-document-v2'

  /** How the operad is drawn: the recursive tree, the SvelteFlow wiring diagram, or both side by side. */
  type OperadView = 'tree' | 'flow' | 'both'
  const OPERAD_VIEWS: OperadView[] = ['tree', 'flow', 'both']
  const VIEW_KEY = 'hazel-gf-operad-view'
  let operadView = $state<OperadView>('both')

  function setOperadView(view: OperadView) {
    operadView = view
    localStorage.setItem(VIEW_KEY, view)
    const url = new URL(location.href)
    url.searchParams.set('operad', view)
    window.history.replaceState(null, '', url)
  }

  let paradigms = $state<Paradigms>()

  /** Write a candidate into the focused hole; an inflected form also pins what it commits to. */
  function write(candidate: Candidate) {
    if (focused.kind !== 'hole') return
    try {
      commit(insertAt(document, focused.id, candidate.subtree))
      if (candidate.pins.length) pinned = [...new Set([...pinned, ...pinnable(candidate.pins)])]
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Write failed' }
  }

  function move(subtree: NodeId, parent: NodeId, port: number) {
    try { commit(moveSubtree(document, subtree, parent, port)) }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Move failed' }
  }
  const runtime = createRuntime()
  let document = $state<EditorDocument>(newDocument())
  let history = $state<EditorDocument[]>([])
  let future = $state<EditorDocument[]>([])
  let revision = $state(0)
  let projections = $state<LinearizationProjection[]>([])
  let linked = $state<NodeId[]>([])
  /** Tense/aspect features pinned by clicking morphemes; they constrain the Temp leaf. */
  let pinned = $state<string[]>([])
  let runtimeState = $state<'connecting' | 'online' | 'offline'>('connecting')
  let error = $state('')
  let importInput: HTMLInputElement

  const focused = $derived(findNode(document.root, document.focus) ?? document.root)
  const allChoices = $derived(focused.kind === 'hole' ? producers(focused.expected) : [])
  const choices = $derived(focused.kind === 'hole' && focused.expected === 'Temp'
    ? allowedTenses(pinned).filter(tense => allChoices.some(choice => choice.id === tense.id))
    : allChoices)
  const pin = (features: string[]) => { pinned = togglePins(pinned, features) }
  const wrapChoices = $derived(focused.kind === 'apply'
    ? wrappers(outputOf(focused)).filter(item => item.constructor.output === outputOf(focused))
    : [])

  const complete = $derived(isComplete(document.root))

  function pickTense(tense: ConstructorId) {
    if (document.root.kind !== 'apply') return
    commit({ ...document, root: swapLeaf(document.root, document.root.children[0].id, tense) })
  }

  const clone = (value: EditorDocument): EditorDocument => $state.snapshot(value) as EditorDocument

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document))
  }

  function commit(next: EditorDocument) {
    history = [...history, clone(document)].slice(-80)
    future = []
    document = next
    persist()
    void refresh()
  }

  async function refresh() {
    const current = ++revision
    projections = partialProjections(document.root, current)
    error = ''
    if (!isComplete(document.root)) return
    try {
      const complete = await runtime.linearize(toGfTerm(document.root), document.root, current)
      if (current !== revision) return
      projections = complete
      runtimeState = 'online'
    } catch (cause) {
      if (current !== revision) return
      runtimeState = 'offline'
      error = cause instanceof Error ? cause.message : 'GF is unavailable'
    }
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    future = [clone(document), ...future]
    history = history.slice(0, -1)
    document = previous
    persist()
    void refresh()
  }

  function redo() {
    const next = future[0]
    if (!next) return
    history = [...history, clone(document)]
    future = future.slice(1)
    document = next
    persist()
    void refresh()
  }

  function focus(id: NodeId) { document = { ...document, focus: id } }

  function keydown(event: KeyboardEvent) {
    const typing = event.target as HTMLElement | null
    if (typing && ['INPUT', 'TEXTAREA', 'SELECT'].includes(typing.tagName)) return
    const modifier = event.metaKey || event.ctrlKey
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      event.shiftKey ? redo() : undo()
      return
    }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
    const direction = event.key === 'ArrowUp' ? 'parent' : event.key === 'ArrowDown' ? 'firstChild'
      : event.key === 'ArrowLeft' ? 'previous' : event.key === 'ArrowRight' ? 'next' : undefined
    if (direction) { event.preventDefault(); document = moveFocus(document, direction); return }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return
      event.preventDefault()
      commit(clearFocused(document))
    }
  }

  async function copyGf() {
    if (!isComplete(document.root)) return
    await navigator.clipboard.writeText(toGfTerm(document.root))
  }

  function downloadDocument() {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
    const link = Object.assign(globalThis.document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'hazel-gf-document.json',
    })
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function importDocument(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const value: unknown = JSON.parse(await file.text())
      if (!validateDocument(value)) throw new Error('Document schema, grammar fingerprint, or tree typing is invalid')
      commit(value)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Import failed'
    } finally {
      importInput.value = ''
    }
  }

  onMount(() => {
    const requested = new URLSearchParams(location.search).get('operad') ?? localStorage.getItem(VIEW_KEY)
    if (OPERAD_VIEWS.includes(requested as OperadView)) operadView = requested as OperadView
    const preset = new URLSearchParams(location.search).get('example')
    if (preset === 'see') document = exampleDocument()
    else if (preset === 'agreement') document = agreementExample()
    else if (preset === 'place') document = prepositionExample()
    else if (preset === 'with') document = modifierExample()
    else {
      const saved = localStorage.getItem(STORAGE_KEY)
      try {
        const parsed: unknown = saved ? JSON.parse(saved) : undefined
        if (parsed && validateDocument(parsed)) document = parsed
      } catch { /* retain a fresh document */ }
    }
    void runtime.loadGrammar().then(() => { runtimeState = 'online' }).catch(() => { runtimeState = 'offline' })
    void loadParadigms().then(loaded => { paradigms = loaded }).catch(() => {})
    void refresh()
  })
</script>

<svelte:window onkeydown={keydown} />

<header>
  <div>
    <p class="eyebrow">Hazelnut edit semantics · GF linearization</p>
    <h1>One tree, three voices</h1>
    <p class="lede">Construct a typed clause. Every surface span remains linked to the colored tree that produced it.</p>
  </div>
  <div class="status" class:offline={runtimeState === 'offline'}>
    <span></span>{runtimeState === 'online' ? runtime.label : runtimeState === 'offline' ? 'GF offline · preview only' : 'connecting'}
  </div>
</header>

<main>
  <aside class="palette-panel">
    <div class="panel-heading">
      <div><span class="kicker">focused sort</span><strong style:color={CATEGORY_COLORS[outputOf(focused)].ink}>{outputOf(focused)}</strong></div>
      <div class="history"><button disabled={!history.length} onclick={undo}>undo</button><button disabled={!future.length} onclick={redo}>redo</button></div>
    </div>

    {#if focused.kind === 'hole'}
      <WriteBox expected={focused.expected} {paradigms} onWrite={write} />
      <p class="instruction">…or choose an operation whose output is <b>{focused.expected}</b>.</p>
      {#if choices.length < allChoices.length}
        <p class="pin-note">{allChoices.length - choices.length} hidden by pinned {pinned.join(' · ')}</p>
      {/if}
      <div class="choices">
        {#each choices as choice}
          <button class="choice" onclick={() => commit(fillFocused(document, choice.id))}>
            <strong>{choice.label}</strong><code>{choice.id}</code><span>{profile(choice)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="instruction">This operation synthesizes <b>{focused.output}</b>. Clear it to a typed hole or wrap it at a matching input.</p>
      <button class="danger" onclick={() => commit(clearFocused(document))}>clear to ⟦{focused.output}⟧</button>
      {#if wrapChoices.length}
        <span class="kicker wraps-title">type-correct wrappers</span>
        <div class="choices compact">
          {#each wrapChoices as item}
            <button class="choice" onclick={() => commit(wrapFocused(document, item.constructor.id, item.inputIndex))}>
              <strong>{item.constructor.label}</strong><span>input {item.inputIndex + 1} · {profile(item.constructor)}</span>
            </button>
          {/each}
        </div>
      {/if}
    {/if}

    <div class="examples">
      <span class="kicker">worked trees</span>
      <button onclick={() => commit(exampleDocument())}>I see the woman</button>
      <button onclick={() => commit(agreementExample())}>the man does not sleep</button>
      <button onclick={() => commit(prepositionExample())}>the man sleeps in the house</button>
      <button onclick={() => commit(modifierExample())}>I see the woman with the dog</button>
      <button onclick={() => commit(newDocument())}>blank sentence</button>
    </div>
  </aside>

  <section class="workspace">
    <div class="workspace-bar">
      <div><span class="kicker">abstract syntax</span><code>{isComplete(document.root) ? toGfTerm(document.root) : 'incomplete but well-typed'}</code></div>
      <div class="view-toggle" role="radiogroup" aria-label="Operad view">
        {#each OPERAD_VIEWS as view}
          <button role="radio" aria-checked={operadView === view} class:on={operadView === view} onclick={() => setOperadView(view)}>{view}</button>
        {/each}
      </div>
      <div class="document-actions">
        <button onclick={downloadDocument}>export JSON</button>
        <button onclick={() => importInput.click()}>import</button>
        <button disabled={!isComplete(document.root)} onclick={copyGf}>copy GF</button>
        <input bind:this={importInput} type="file" accept="application/json" onchange={importDocument} />
      </div>
    </div>

    <div class="operad-views {operadView}">
      {#if operadView !== 'flow'}
        <div class="tree-scroll">
          <span class="surface-label operad-label">operad · tree</span>
          <TreeNode node={document.root} focus={document.focus} {linked} onFocus={focus} onHover={ids => linked = ids} />
        </div>
      {/if}
      {#if operadView !== 'tree'}
        <div class="flow-panel">
          <span class="surface-label operad-label">operad · svelteflow wiring</span>
          <OperadFlow root={document.root} focus={document.focus} {linked} onFocus={focus} onHover={ids => linked = ids} onMove={move} />
        </div>
      {/if}
    </div>

    <div class="projections">
      <div class="projection-heading">
        <div><span class="kicker">algebras · concrete syntax</span><h2>Linearized fibers</h2></div>
        <p>Words split into morphemes; <b>warm</b> hue = feature axis, <b>∅</b> = empty exponent, wavy = changed stem.
          Hairline boxes below are the operad's image on the page. Click a morpheme to pin its tense.</p>
      </div>
      {#if pinned.length}
        <div class="pins">
          <span class="kicker">pinned</span>
          {#each pinned as feature}<button onclick={() => pin([feature])}>{feature} ×</button>{/each}
          <button class="clear" onclick={() => pinned = []}>clear</button>
        </div>
      {/if}
      {#each projections as projection (projection.language)}
        <AlgebraRow {projection} root={document.root} focus={document.focus} {linked} {pinned} onFocus={focus} onHover={ids => linked = ids} onPin={pin} />
      {/each}
      {#if error}<p class="error">{error}</p>{/if}
    </div>

    {#if complete && document.root.kind === 'apply'}
      <TenseVariations root={document.root} {runtime} {linked} {pinned} onPick={pickTense} onHover={ids => linked = ids} onPin={pin} />
    {/if}
  </section>
</main>

<footer>
  <span>↑ parent · ↓ child · ←/→ sibling · ⌘Z undo</span>
  <span>Incomplete trees are owned by the browser; GF never receives raw metavariables.</span>
</footer>
