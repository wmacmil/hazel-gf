<script lang="ts">
  import { onMount } from 'svelte'
  import TreeNode from './components/TreeNode.svelte'
  import AlgebraRow from './components/AlgebraRow.svelte'
  import TenseVariations from './components/TenseVariations.svelte'
  import OperadFlow from './components/OperadFlow.svelte'
  import SentenceBox from './components/SentenceBox.svelte'
  import BuilderCanvas from './components/BuilderCanvas.svelte'
  import { emptyBench, removeFragment, addFragment, type Workbench } from './lib/builder'
  import { createRuntime, loadParadigms } from './lib/gf'
  import TypeSearch from './components/TypeSearch.svelte'
  import type { SearchResult } from './lib/search'
  import type { Paradigms } from './lib/morphology'
  import { producers, profile, wrappers } from './lib/grammar'
  import {
    clearFocused, fillFocused, findNode, reserveIds, isComplete, newDocument, outputOf,
    fromGfTerm, insertAt, moveSubtree, preorder, swapLeaf, toGfTerm, validateDocument, wrapFocused,
  } from './lib/editor'
  import { agreementExample, exampleDocument, modifierExample, prepositionExample } from './lib/examples'
  import { partialProjections } from './lib/projection'
  import { allowedTenses, pinnable, togglePins } from './lib/constraints'
  import { columnFit } from './lib/layout'
  import { POS_FAMILIES, hueToHex, palette, resetHues, setFamilyColor, sortColor, type PosFamily } from './lib/palette.svelte'
  import { PROFILES, keySpecOf, resolveKey, type CommandId, type Region } from './lib/nav/commands'
  import GraftPrompt from './components/GraftPrompt.svelte'
  import { GRAFT_MODES, cloneFresh, cut, extend, substitute, type GraftCandidate, type GraftMode } from './lib/graft'
  import { resolveNavigation, type Direction, type GraphNavigationConfig, type StructuralMove } from './lib/nav/graph-theory'
  import { flowGeometry, stepWord, structureOf, type WordStop } from './lib/nav/projections'
  import { type ConstructorId, type EditorDocument, type LinearizationProjection, type NodeId } from './lib/model'

  const STORAGE_KEY = 'hazel-gf-document-v2'

  /**
   * View settings, each in the URL (?operad=…) and remembered locally:
   * mode — view (full width, parse to explore) or edit (the palette column appears);
   * operad — the operad as a SvelteFlow wiring diagram, a recursive tree, or the
   *          Operad14-style builder (a workbench of fragments wired by type);
   * layout — where the graph sits relative to the sentences; details stay below;
   * colors — the colour theory (lib/palette.svelte.ts): channels (hue = abstract vs
   *          concrete) or pos (hue = part of speech, shade = abstract vs concrete);
   * lines — languages as columns (l1 | l2 | l3) or rows; auto picks columns
   *         while every sentence is short.
   * boxes — the phrase-box tree under each sentence: shown, folded (just the
   *         sentences, side by side), or auto (folded once the tree has no
   *         holes left). `z` flips it.
   */
  const OPTIONS = {
    mode: ['view', 'edit'],
    operad: ['flow', 'tree', 'builder'],
    layout: ['right', 'left', 'above', 'below'],
    lines: ['auto', 'columns', 'rows'],
    colors: ['channels', 'pos'],
    boxes: ['shown', 'auto', 'folded'],
  } as const
  type Setting = keyof typeof OPTIONS
  let settings = $state<{ [key in Setting]: (typeof OPTIONS)[key][number] }>({ mode: 'view', operad: 'flow', layout: 'right', lines: 'auto', colors: 'channels', boxes: 'shown' })

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
    'the big dog sleeps': () => fromTerm('MkS Present Positive (PredVP (DetCN Definite (AdjCN (PositA BigA) (UseN DogN))) (UseV SleepV))'),
    'there is a bird': () => fromTerm('MkS Present Positive (ExistNP (DetCN Indefinite (UseN BirdN)))'),
    'every teacher helps the child': () => fromTerm('MkS Present Positive (PredVP (DetCN EveryDet (UseN TeacherN)) (ComplV2 HelpV2 (DetCN Definite (UseN ChildN))))'),
    'the man and the woman swim': () => fromTerm('MkS Present Positive (PredVP (ConjNP AndConj (DetCN Definite (UseN ManN)) (DetCN Definite (UseN WomanN))) (UseV SwimV))'),
    'I sleep, or you won’t run': () => fromTerm('ConjS OrConj (MkS Present Positive (PredVP (UsePron IPron) (UseV SleepV))) (MkS Future Negative (PredVP (UsePron YouPron) (UseV RunV)))'),
    'blank sentence': newDocument,
  }

  function fromTerm(term: string): EditorDocument {
    const root = fromGfTerm(term)
    return { ...newDocument(), root, focus: root.id }
  }

  function loadParsed(term: string) {
    const root = fromGfTerm(term)
    commit({ ...document, root, focus: root.id })
  }

  let paradigms = $state<Paradigms>()

  let searchInput = $state<HTMLInputElement>()

  /** The builder's workbench, remembered locally (fragments may hold holes, so stored as trees, not terms). */
  const BENCH_KEY = 'hazel-gf-bench'
  let bench = $state<Workbench>(emptyBench())
  $effect(() => { localStorage.setItem(BENCH_KEY, JSON.stringify(bench)) })
  function adopt(fragment: import('./lib/model').Node) {
    commit({ ...document, root: fragment, focus: fragment.id }, removeFragment(bench, fragment.id))
  }
  function sendSentence() {
    commitBench(addFragment(bench, cloneFresh(document.root)))
  }

  /**
   * Keyboard grafting (lib/graft.ts): i insert, g graft, e extend at the
   * focused node — in the sentence, or in a bench fragment when the builder's
   * tree has focus — x cuts the focused subtree to the bench, a starts a new
   * fragment. A replaced subtree always lands on the bench.
   */
  type GraftSite = { kind: 'document'; node: NodeId } | { kind: 'bench'; fragment: NodeId; node: NodeId } | { kind: 'new' }
  let graft = $state<{ mode: GraftMode; site: GraftSite }>()

  function siteOfFocus(): GraftSite {
    if (onBench) {
      const home = benchFocus ? bench.fragments.find(fragment => findNode(fragment, benchFocus!)) : undefined
      return home && benchFocus ? { kind: 'bench', fragment: home.id, node: benchFocus } : { kind: 'new' }
    }
    return { kind: 'document', node: document.focus }
  }
  function siteNode(site: GraftSite) {
    if (site.kind === 'document') return findNode(document.root, site.node)
    if (site.kind === 'bench') return bench.fragments.find(fragment => fragment.id === site.fragment) && findNode(bench.fragments.find(fragment => fragment.id === site.fragment)!, site.node)
  }
  const graftModes = (site: GraftSite): GraftMode[] => site.kind === 'new' ? ['insert', 'graft'] : siteNode(site)?.kind === 'hole' ? ['insert', 'graft'] : GRAFT_MODES

  function openGraft(mode: GraftMode, site: GraftSite = siteOfFocus()) {
    if (settings.mode !== 'edit') setSetting('mode', 'edit')
    graft = { mode: graftModes(site).includes(mode) ? mode : 'insert', site }
  }

  function applyGraft(candidate: GraftCandidate, mode: GraftMode) {
    if (!graft) return
    const { site } = graft
    try {
      // A bench fragment moves (it leaves the bench); into a new fragment it is copied.
      let nextBench = candidate.fragment && site.kind !== 'new' ? removeFragment(bench, candidate.fragment) : bench
      if (site.kind === 'new') {
        const fragment = candidate.fragment ? cloneFresh(candidate.expression) : candidate.expression
        commitBench(addFragment(nextBench, fragment))
        benchFocus = preorder(fragment).find(node => node.kind === 'hole')?.id ?? fragment.id
      } else if (site.kind === 'document') {
        const edit = mode === 'extend' ? extend(document.root, site.node, candidate.expression) : substitute(document.root, site.node, candidate.expression)
        if (edit.displaced) nextBench = addFragment(nextBench, edit.displaced)
        commit({ ...document, root: edit.root, focus: edit.focus }, nextBench)
        if (candidate.pins?.length) pinned = [...new Set([...pinned, ...pinnable(candidate.pins)])]
      } else {
        const home = nextBench.fragments.find(fragment => fragment.id === site.fragment)
        if (!home) throw new Error('That fragment is gone')
        const edit = mode === 'extend' ? extend(home, site.node, candidate.expression) : substitute(home, site.node, candidate.expression)
        nextBench = { fragments: nextBench.fragments.map(fragment => fragment === home ? edit.root : fragment) }
        if (edit.displaced) nextBench = addFragment(nextBench, edit.displaced)
        commitBench(nextBench)
        benchFocus = edit.focus
      }
      graft = undefined
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Graft failed' }
  }

  /** x: cut the focused subtree out to the bench, leaving a typed hole. */
  function cutFocused() {
    const site = siteOfFocus()
    if (site.kind === 'document') {
      const edit = cut(document.root, site.node)
      if (edit?.displaced) commit({ ...document, root: edit.root, focus: edit.focus }, addFragment(bench, edit.displaced))
    } else if (site.kind === 'bench') {
      const home = bench.fragments.find(fragment => fragment.id === site.fragment)!
      if (home.id === site.node) return
      const edit = cut(home, site.node)
      if (!edit?.displaced) return
      commitBench(addFragment({ fragments: bench.fragments.map(fragment => fragment === home ? edit.root : fragment) }, edit.displaced))
      benchFocus = edit.focus
    }
  }

  /** Insert a found expression into the focused hole; a word match also pins what its form commits to. */
  function insertFound(result: SearchResult) {
    if (focused.kind !== 'hole') return
    try {
      commit(insertAt(document, focused.id, result.expression))
      if (result.word?.pins.length) pinned = [...new Set([...pinned, ...pinnable(result.word.pins)])]
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Insert failed' }
  }

  function move(subtree: NodeId, parent: NodeId, port: number) {
    try { commit(moveSubtree(document, subtree, parent, port)) }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Move failed' }
  }
  const runtime = createRuntime()
  let document = $state<EditorDocument>(newDocument())
  /** Undo covers the document and the bench together: a graft can move a fragment from one to the other. */
  type Snapshot = { document: EditorDocument; bench: Workbench }
  let history = $state<Snapshot[]>([])
  let future = $state<Snapshot[]>([])
  let revision = $state(0)
  let projections = $state<LinearizationProjection[]>([])
  let linked = $state<NodeId[]>([])
  /** Tense/aspect features pinned by clicking morphemes; they constrain the Temp leaf. */
  let pinned = $state<string[]>([])
  let runtimeState = $state<'connecting' | 'online' | 'offline'>('connecting')
  let error = $state('')
  let importInput: HTMLInputElement

  // The palette follows the setting; per-POS hues are the user's, remembered locally.
  const HUES_KEY = 'hazel-gf-hues'
  $effect(() => { palette.theory = settings.colors })
  $effect(() => { localStorage.setItem(HUES_KEY, JSON.stringify(palette.hues)) })

  /** Width of the sentences pane, measured live; `lines: auto` uses columns only when every sentence fits. */
  let linesWidth = $state(0)
  const fit = $derived(columnFit(projections, linesWidth))
  const boxesFolded = $derived(settings.boxes === 'folded' || (settings.boxes === 'auto' && isComplete(document.root)))
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

  const snapshot = (): Snapshot => ({ document: clone(document), bench: $state.snapshot(bench) as Workbench })

  function commit(next: EditorDocument, nextBench: Workbench = bench) {
    history = [...history, snapshot()].slice(-80)
    future = []
    const changed = next !== document
    document = next
    bench = nextBench
    persist()
    if (changed) void refresh()
  }
  const commitBench = (next: Workbench) => commit(document, next)

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
    future = [snapshot(), ...future]
    history = history.slice(0, -1)
    document = previous.document
    bench = previous.bench
    persist()
    void refresh()
  }

  function redo() {
    const next = future[0]
    if (!next) return
    history = [...history, snapshot()]
    future = future.slice(1)
    document = next.document
    bench = next.bench
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

  /** In the builder the tree region walks the bench's fragments, with a focus of its own. */
  let benchFocus = $state<NodeId>()
  const onBench = $derived(settings.operad === 'builder' && region === 'tree')

  function moveTo(target: NodeId | null | undefined) {
    if (!target) return
    if (onBench) {
      if (!bench.fragments.some(fragment => findNode(fragment, target))) return
      benchFocus = target
    } else {
      if (!findNode(document.root, target)) return
      focus(target)
    }
    camera = { nodeId: target, seq: (camera?.seq ?? 0) + 1 }
  }

  function navigate(intent: { kind: 'direction'; direction: Direction } | { kind: 'structure'; move: StructuralMove }) {
    const decision = resolveNavigation({
      focusedId: onBench ? benchFocus ?? null : document.focus,
      structure: structureOf(onBench ? bench.fragments : document.root),
      // Structural navigation reads no geometry; the builder's is wherever fragments were dragged.
      geometry: onBench ? { rects: new Map() } : flowGeometry(document.root),
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
      case 'view.fold': return setSetting('boxes', boxesFolded ? 'shown' : 'folded')
      case 'edit.insert': return openGraft('insert')
      case 'edit.graft': return openGraft('graft')
      case 'edit.extend': return openGraft('extend')
      case 'edit.new': return openGraft('insert', { kind: 'new' })
      case 'edit.cut': return cutFocused()
      case 'search.open':
        if (settings.mode !== 'edit') setSetting('mode', 'edit')
        requestAnimationFrame(() => searchInput?.focus())
        return
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
      reserveIds(value.root)
      commit(value)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Import failed'
    } finally {
      importInput.value = ''
    }
  }

  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HUES_KEY) ?? 'null') as Partial<Record<PosFamily, number>> | null
      if (saved) palette.hues = { ...palette.hues, ...Object.fromEntries(Object.entries(saved).filter(([family, hue]) => family in POS_FAMILIES && typeof hue === 'number')) }
    } catch { /* keep the defaults */ }
    try {
      const saved = JSON.parse(localStorage.getItem(BENCH_KEY) ?? 'null') as Workbench | null
      if (saved && Array.isArray(saved.fragments)) { reserveIds(...saved.fragments); bench = saved }
    } catch { /* start with an empty bench */ }
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
    reserveIds(document.root)
    void runtime.loadGrammar().then(() => { runtimeState = 'online' }).catch(() => { runtimeState = 'offline' })
    void loadParadigms().then(loaded => { paradigms = loaded }).catch(() => {})
    void refresh()
  })
</script>

<svelte:window onkeydown={keydown} />

{#if graft}
  {@const node = graft.site.kind === 'new' ? undefined : siteNode(graft.site)}
  <GraftPrompt bind:mode={graft.mode} modes={graftModes(graft.site)} sort={node ? outputOf(node) : undefined}
    place={graft.site.kind === 'new' ? 'new bench fragment' : graft.site.kind === 'bench' ? 'bench fragment' : 'sentence'}
    {bench} {paradigms} excluded={graft.site.kind === 'bench' ? graft.site.fragment : undefined}
    onApply={applyGraft} onClose={() => graft = undefined} />
{/if}


<main class:editing={settings.mode === 'edit'}>
  {#if settings.mode === 'edit'}
  <aside class="palette-panel">
    <div class="panel-heading">
      <div><span class="kicker">focused sort</span><strong style:color={sortColor(outputOf(focused)).concrete.ink}>{outputOf(focused)}</strong></div>
      <div class="history"><button disabled={!history.length} onclick={undo}>undo</button><button disabled={!future.length} onclick={redo}>redo</button></div>
    </div>

    {#if focused.kind === 'hole'}
      <TypeSearch target={focused.expected} {paradigms} onInsert={insertFound} bind:input={searchInput} />
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
      <div><span class="kicker">abstract syntax</span><code title={isComplete(document.root) ? toGfTerm(document.root) : ''}>{isComplete(document.root) ? toGfTerm(document.root) : 'incomplete but well-typed'}</code></div>
      <div class="status" class:offline={runtimeState === 'offline'}>
        <span></span>{runtimeState === 'online' ? runtime.label : runtimeState === 'offline' ? 'GF offline · preview only' : 'connecting'}
      </div>
      <div class="region-chip" data-region={region} title="Tab switches region · hjkl moves in its tree · s/d moves along the sentence · [ ] changes language · = fits · i insert · g graft · e extend · x cut to bench · a new fragment · z fold the phrase boxes">
        <span>focus</span><b>{region}</b><kbd>hjkl</kbd><kbd>s d</kbd><kbd>[ ]</kbd><kbd>⇥</kbd><kbd>i g e x a</kbd>
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
      {#if settings.colors === 'pos'}
        <details class="palette-editor">
          <summary>palette</summary>
          <div class="families">
            {#each Object.entries(POS_FAMILIES) as [family, spec]}
              <label>
                <input type="color" value={hueToHex(palette.hues[family as PosFamily])}
                  oninput={event => setFamilyColor(family as PosFamily, (event.currentTarget as HTMLInputElement).value)} />
                <span>{spec.label}</span>
                <i style:background={sortColor(spec.sorts[0]).abstract.fill} style:color={sortColor(spec.sorts[0]).abstract.accent}>abstract</i>
                <i style:background={sortColor(spec.sorts[0]).concrete.wash} style:color={sortColor(spec.sorts[0]).concrete.ink}>concrete</i>
              </label>
            {/each}
            <button onclick={resetHues}>reset hues</button>
          </div>
        </details>
      {/if}
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
        {#if settings.operad === 'builder'}
          <div class="flow-panel">
            <span class="surface-label operad-label">operad · builder (after Operad14)</span>
            <BuilderCanvas {bench} {paradigms} focus={benchFocus} {camera} {fitSeq} onFocus={id => benchFocus = id} onChange={commitBench} onAdopt={adopt} onSendSentence={sendSentence} />
          </div>
        {:else if settings.operad === 'flow'}
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
            <AlgebraRow folded={boxesFolded} active={region === 'sentence' && index === Math.min(activeLanguage, projections.length - 1)} {projection} root={document.root} focus={document.focus} {linked} {pinned} orientation={lineOrientation} scale={lineOrientation === 'column' ? fit.scale : undefined} onFocus={focus} onHover={ids => linked = ids} onPin={pin} />
          {/each}
        </div>
        {#if error}<p class="error">{error}</p>{/if}
      </div>

      <div class="pane details-pane">
        {#if complete && document.root.kind === 'apply' && document.root.constructor === 'MkS'}
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
