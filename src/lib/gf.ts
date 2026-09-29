import type { LanguageId, LinearizationProjection, Node } from './model'
import { normalizeLinearizations, type RawLinearization } from './projection'
import type { Paradigms } from './morphology'
import { LANGUAGE_IDS } from './languages'
import { linearizeInBrowser, loadBrowserGrammar, type BrowserGrammar } from './browser-gf'

export interface GfRuntime {
  readonly label: string
  loadGrammar(): Promise<unknown>
  linearize(term: string, root: Node, revision: number): Promise<LinearizationProjection[]>
}

const SUPPORTED = new Set<LanguageId>(LANGUAGE_IDS)

let paradigms: Promise<Paradigms> | undefined

/** GF paradigm tables (scripts/oracle.mjs), used to split words into morphemes. */
function loadParadigms(): Promise<Paradigms> {
  paradigms ??= fetch(`${import.meta.env.BASE_URL}static/paradigms.json`).then(response => {
    if (!response.ok) throw new Error(`paradigms.json request failed (${response.status})`)
    return response.json() as Promise<Paradigms>
  })
  paradigms.catch(() => { paradigms = undefined })
  return paradigms
}

async function project(raw: RawLinearization[], root: Node, revision: number): Promise<LinearizationProjection[]> {
  const filtered = raw.filter(item => SUPPORTED.has(item.to as LanguageId))
  if (filtered.length !== SUPPORTED.size) throw new Error(`GF returned ${filtered.length} of ${SUPPORTED.size} concrete syntaxes`)
  return normalizeLinearizations(filtered, root, revision, await loadParadigms())
}

export class HttpGfRuntime implements GfRuntime {
  readonly label = 'GF 3.11 connected'

  constructor(private readonly grammarUrl = '/HazelGF.pgf') {}

  async loadGrammar(): Promise<unknown> {
    const response = await fetch(`${this.grammarUrl}?${new URLSearchParams({ command: 'grammar' })}`)
    if (!response.ok) throw new Error(`GF grammar request failed (${response.status})`)
    return response.json()
  }

  async linearize(term: string, root: Node, revision: number): Promise<LinearizationProjection[]> {
    const query = new URLSearchParams({ command: 'linearize', tree: term })
    const response = await fetch(`${this.grammarUrl}?${query}`)
    if (!response.ok) throw new Error(`GF linearization failed (${response.status})`)
    return project(await response.json() as RawLinearization[], root, revision)
  }
}

/** Linearizes in the browser with gf-typescript over HazelGF.json; no GF server needed. */
export class BrowserGfRuntime implements GfRuntime {
  readonly label = 'GF 3.11 · in browser'
  private grammar?: Promise<BrowserGrammar>

  constructor(private readonly grammarUrl = `${import.meta.env.BASE_URL}HazelGF.json`) {}

  loadGrammar(): Promise<BrowserGrammar> {
    this.grammar ??= fetch(this.grammarUrl).then(async response => {
      if (!response.ok) throw new Error(`HazelGF.json request failed (${response.status})`)
      return loadBrowserGrammar(await response.json())
    })
    this.grammar.catch(() => { this.grammar = undefined })
    return this.grammar
  }

  async linearize(term: string, root: Node, revision: number): Promise<LinearizationProjection[]> {
    return project(linearizeInBrowser(await this.loadGrammar(), term, root, [...SUPPORTED]), root, revision)
  }
}

/** `http` talks to a local GF server (npm run dev); `browser` runs GF in the page (the static site). */
export function createRuntime(): GfRuntime {
  return import.meta.env.VITE_GF_MODE === 'browser' ? new BrowserGfRuntime() : new HttpGfRuntime()
}
