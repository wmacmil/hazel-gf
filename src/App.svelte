<script lang="ts">
  import { onMount } from 'svelte'
  import TreeNode from './components/TreeNode.svelte'
  import AlgebraRow from './components/AlgebraRow.svelte'
  import TenseVariations from './components/TenseVariations.svelte'
  import OperadFlow from './components/OperadFlow.svelte'
  import SentenceBox from './components/SentenceBox.svelte'
  import { createRuntime, loadParadigms } from './lib/gf'
  import WriteBox from './components/WriteBox.svelte'
  import type { Paradigms } from './lib/morphology'
  import type { Candidate } from './lib/writing'
  import { producers, profile, wrappers } from './lib/grammar'
  import {
    clearFocused, fillFocused, findNode, isComplete, newDocument, outputOf,
    fromGfTerm, insertAt, moveSubtree, swapLeaf, toGfTerm, validateDocument, wrapFocused,
  } from './lib/editor'
  import { agreementExample, exampleDocument, modifierExample, prepositionExample } from './lib/examples'
  import { partialProjections } from './lib/projection'
  import { allowedTenses, pinnable, togglePins } from './lib/constraints'
  import { columnFit } from './lib/layout'
  import { PROFILES, keySpecOf, resolveKey, type CommandId, type Region } from './lib/nav/commands'
  import { resolveNavigation, type Direction, type GraphNavigationConfig, type StructuralMove } from './lib/nav/graph-theory'
  import { flowGeometry, stepWord, structureOf, type WordStop } from './lib/nav/projections'
  import { CATEGORY_COLORS, type ConstructorId, type EditorDocument, type LinearizationProjection, type NodeId } from './lib/model'

  const STORAGE_KEY = 'hazel-gf-document-v2'

  /**
   * View settings, each in the URL (?operad=…) and remembered locally:
   * mode — view (full width, parse to explore) or edit (the palette column appears);
   * operad — the operad as a SvelteFlow wiring diagram or a recursive tree;
   * layout — where the graph sits relative to the sentences; details stay below;
   * lines — languages as columns (l1 | l2 | l3) or rows; auto picks columns
   *         while every sentence is short.
   */
  const OPTIONS = {
    mode: ['view', 'edit'],
    operad: ['flow', 'tree'],
    layout: ['right', 'left', 'above', 'below'],
    lines: ['auto', 'columns', 'rows'],
  } as const
  type Setting = keyof typeof OPTIONS
  let settings = $state<{ [key in Setting]: (typeof OPTIONS)[key][number] }>({ mode: 'view', operad: 'flow', layout: 'right', lines: 'auto' })

  function setSetting<K extends Setting>(key: K, value: (typeof OPTIONS)[K][number]) {
    settings = { ...settings, [key]: value }
    localStorage.setItem(`hazel-gf-${key}`, value)
    const url = new URL(location.href)
    url.searchParams.set(key, value)
    window.history.replaceState(null, '', url)
  }

  const WORKED: Record<string, () => EditorDocument> = {
    'I see the woman': exampleDocument,
    'the man does not sleep': agreementExample,
    'the man sleeps in the house': prepositionExample,
    'I see the woman with the dog': modifierExample,
    'blank sentence': newDocument,
  }

  function loadParsed(term: string) {
    const root = fromGfTerm(term)
    commit({ ...document, root, focus: root.id })
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

  /** Width of the sentences pane, measured live; `lines: auto` uses columns only when every sentence fits. */
  let linesWidth = $state(0)
  const fit = $derived(columnFit(projections, linesWidth))
  const lineOrientation = $derived<'row' | 'column'>(
    settings.lines === 'columns' ? 'column'
      : settings.lines === 'rows' ? 'row'
        : fit.fits ? 'column' : 'row')


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

  /**
   * Navigation (ported from the document-configuration-system; see src/lib/nav).
   * One focused node, two regions: `tree` (the operad graph) and `sentence` (the
   * text with its phrase-box tree). hjkl moves in the active region's tree over
   * that region's geometry; s/d walks the active sentence word by word; both
   * trees highlight the same node, so they always move together.
   */
  let region = $state<Region>('tree')
  let activeLanguage = $state(0)
  /** Keyboard moves bump `seq`; the graph camera follows them and nothing else. */
  let camera = $state<{ nodeId: string; seq: number }>()
  let fitSeq = $state(0)
  /** The s/d lane's own position (a word, not a tree node). */
  let wordStop: WordStop | undefined
  /**
   * hjkl is structural in both trees, so they cannot disagree: j/k first child /
   * parent, h/l the neighbouring node on the same level (siblings, then cousins).
   * Spatial strategies depended on each drawing's geometry and dead-ended where
   * a box spans the whole sentence (PredVP); they remain in lib/nav for other views.
   */
  const NAV: GraphNavigationConfig = { strategy: 'structural-v1', spatialAlgorithm: 'css-nav-grid-v1', boundary: 'stop', structuralSequence: 'level' }
  const activeProjection = $derived(projections[Math.min(activeLanguage, projections.length - 1)])

  function moveTo(target: NodeId | null | undefined) {
    if (!target || !findNode(document.root, target)) return
    focus(target)
    camera = { nodeId: target, seq: (camera?.seq ?? 0) + 1 }
  }

  function navigate(intent: { kind: 'direction'; direction: Direction } | { kind: 'structure'; move: StructuralMove }) {
    const decision = resolveNavigation({
      focusedId: document.focus,
      structure: structureOf(document.root),
      geometry: flowGeometry(document.root),
      orientation: 'top-to-bottom',
    }, intent, NAV)
    moveTo(decision?.targetId)
  }

  /** The one adapter from semantic command ids to actions. */
  function dispatch(command: CommandId) {
    switch (command) {
      case 'region.toggle': region = region === 'tree' ? 'sentence' : 'tree'; return
      case 'nav.west': return navigate({ kind: 'direction', direction: 'west' })
      case 'nav.east': return navigate({ kind: 'direction', direction: 'east' })
      case 'nav.north': return navigate({ kind: 'direction', direction: 'north' })
      case 'nav.south': return navigate({ kind: 'direction', direction: 'south' })
      case 'nav.parent': return navigate({ kind: 'structure', move: 'parent' })
      case 'nav.first-child': return navigate({ kind: 'structure', move: 'first-child' })
      case 'nav.previous': return navigate({ kind: 'structure', move: 'previous' })
      case 'nav.next': return navigate({ kind: 'structure', move: 'next' })
      case 'word.previous':
      case 'word.next': {
        if (!activeProjection) return
        const stop = stepWord(document.root, activeProjection, document.focus, command === 'word.next' ? 'next' : 'previous', wordStop)
        if (stop) { wordStop = stop; moveTo(stop.nodeId) }
        return
      }
      case 'language.previous':
      case 'language.next': {
        const count = Math.max(1, projections.length)
        activeLanguage = (activeLanguage + (command === 'language.next' ? 1 : count - 1)) % count
        return
      }
      case 'camera.fit': fitSeq += 1; return
    }
  }

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
    const command = modifier ? null : resolveKey(PROFILES.vim, region, keySpecOf(event))
    if (command) { event.preventDefault(); dispatch(command); return }
    if (settings.mode === 'edit' && (event.key === 'Backspace' || event.key === 'Delete')) {
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
    const query = new URLSearchParams(location.search)
    for (const key of Object.keys(OPTIONS) as Setting[]) {
      const requested = query.get(key) ?? localStorage.getItem(`hazel-gf-${key}`)
      if ((OPTIONS[key] as readonly string[]).includes(requested ?? '')) settings = { ...settings, [key]: requested }
    }
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


<main class:editing={settings.mode === 'edit'}>
  {#if settings.mode === 'edit'}
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

  </aside>
  {/if}

  <section class="workspace">
    <div class="workspace-bar">
      <div><span class="kicker">abstract syntax</span><code>{isComplete(document.root) ? toGfTerm(document.root) : 'incomplete but well-typed'}</code></div>
      <div class="status" class:offline={runtimeState === 'offline'}>
        <span></span>{runtimeState === 'online' ? runtime.label : runtimeState === 'offline' ? 'GF offline · preview only' : 'connecting'}
      </div>
      <div class="region-chip" data-region={region} title="Tab switches region · hjkl moves in its tree · s/d moves along the sentence · [ ] changes language · = fits">
        <span>focus</span><b>{region}</b><kbd>hjkl</kbd><kbd>s d</kbd><kbd>[ ]</kbd><kbd>⇥</kbd>
      </div>
      <div class="view-settings">
        {#each Object.entries(OPTIONS) as [key, values]}
          <div class="view-toggle" role="radiogroup" aria-label={key}>
            <span>{key}</span>
            {#each values as value}
              <button role="radio" aria-checked={settings[key as Setting] === value} class:on={settings[key as Setting] === value}
                onclick={() => setSetting(key as Setting, value as never)}>{value}</button>
            {/each}
          </div>
        {/each}
      </div>
      <label class="worked">
        <span>worked trees</span>
        <select onchange={event => { const pick = WORKED[(event.currentTarget as HTMLSelectElement).value]; if (pick) commit(pick()); (event.currentTarget as HTMLSelectElement).value = '' }}>
          <option value="">choose…</option>
          {#each Object.keys(WORKED) as name}<option value={name}>{name}</option>{/each}
        </select>
      </label>
      <div class="document-actions">
        <button onclick={downloadDocument}>export JSON</button>
        <button onclick={() => importInput.click()}>import</button>
        <button disabled={!isComplete(document.root)} onclick={copyGf}>copy GF</button>
        <input bind:this={importInput} type="file" accept="application/json" onchange={importDocument} />
      </div>
    </div>

    <div class="tiles {settings.layout}">
      <div class="pane graph-pane" role="region" aria-label="Operad tree" class:active-region={region === 'tree'} onpointerdown={() => region = 'tree'}>
        {#if settings.operad === 'flow'}
          <div class="flow-panel">
            <span class="surface-label operad-label">operad · svelteflow wiring</span>
            <OperadFlow root={document.root} focus={document.focus} {linked} {camera} {fitSeq} onFocus={focus} onHover={ids => linked = ids} onMove={move} />
          </div>
        {:else}
          <div class="tree-scroll">
            <span class="surface-label operad-label">operad · tree</span>
            <TreeNode node={document.root} focus={document.focus} {linked} onFocus={focus} onHover={ids => linked = ids} />
          </div>
        {/if}
      </div>

      <div class="pane sentences-pane projections" role="region" aria-label="Sentences" class:active-region={region === 'sentence'} onpointerdown={() => region = 'sentence'}>
        <div class="projection-heading">
          <div><span class="kicker">algebras · concrete syntax</span><h2>Sentences</h2></div>
          <p>Warm hue = feature axis, <b>∅</b> = empty exponent, wavy = changed stem; hairline boxes are the operad's image.
            Click a morpheme to pin its tense. Type below to parse a sentence into the operad.</p>
        </div>
        <SentenceBox {runtime} onLoad={loadParsed} />
        {#if pinned.length}
          <div class="pins">
            <span class="kicker">pinned</span>
            {#each pinned as feature}<button onclick={() => pin([feature])}>{feature} ×</button>{/each}
            <button class="clear" onclick={() => pinned = []}>clear</button>
          </div>
        {/if}
        <div class="sentence-lines {lineOrientation}" style:--languages={projections.length} bind:clientWidth={linesWidth}>
          {#each projections as projection, index (projection.language)}
            <AlgebraRow active={region === 'sentence' && index === Math.min(activeLanguage, projections.length - 1)} {projection} root={document.root} focus={document.focus} {linked} {pinned} orientation={lineOrientation} scale={lineOrientation === 'column' ? fit.scale : undefined} onFocus={focus} onHover={ids => linked = ids} onPin={pin} />
          {/each}
        </div>
        {#if error}<p class="error">{error}</p>{/if}
      </div>

      <div class="pane details-pane">
        {#if complete && document.root.kind === 'apply'}
          <TenseVariations root={document.root} {runtime} {linked} {pinned} onPick={pickTense} onHover={ids => linked = ids} onPin={pin} />
        {:else}
          <p class="details-empty">Details such as tense variations appear once the sentence is complete.</p>
        {/if}
      </div>
    </div>
  </section>
</main>

<footer>
  <span>⇥ tree ⇄ sentence · hjkl move in its tree · s/d along the sentence · [ ] language · = fit · ⌥hjkl structural · ⌘Z undo</span>
  <span>Incomplete trees are owned by the browser; GF never receives raw metavariables.</span>
</footer>
