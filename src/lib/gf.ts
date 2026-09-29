import type { LanguageId, LinearizationProjection, Node } from './model'
import { normalizeLinearizations, type RawLinearization } from './projection'

export interface GfRuntime {
  readonly label: string
  loadGrammar(): Promise<unknown>
  linearize(term: string, root: Node, revision: number): Promise<LinearizationProjection[]>
}

const SUPPORTED = new Set<LanguageId>(['HazelGFEng', 'HazelGFGer', 'HazelGFSwe'])

function project(raw: RawLinearization[], root: Node, revision: number): LinearizationProjection[] {
  const filtered = raw.filter(item => SUPPORTED.has(item.to as LanguageId))
  if (filtered.length !== 3) throw new Error('GF did not return all three concrete syntaxes')
  return normalizeLinearizations(filtered, root, revision)
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

/** Serves GF output precomputed by scripts/precompute.mjs, one shard per tense; no GF server needed. */
export class StaticGfRuntime implements GfRuntime {
  readonly label = 'GF 3.11 · precomputed'
  private readonly shards = new Map<string, Promise<Record<string, RawLinearization[]>>>()

  constructor(private readonly baseUrl = `${import.meta.env.BASE_URL}static/`) {}

  async loadGrammar(): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}grammar.json`)
    if (!response.ok) throw new Error(`grammar.json request failed (${response.status})`)
    return response.json()
  }

  async linearize(term: string, root: Node, revision: number): Promise<LinearizationProjection[]> {
    const raw = (await this.shard(tenseOf(term)))[term]
    if (!raw) throw new Error(`No precomputed linearization for ${term}`)
    return project(raw, root, revision)
  }

  private shard(tense: string): Promise<Record<string, RawLinearization[]>> {
    let shard = this.shards.get(tense)
    if (!shard) {
      shard = fetch(`${this.baseUrl}linearizations-${tense}.json`).then(response => {
        if (!response.ok) throw new Error(`linearizations-${tense}.json request failed (${response.status})`)
        return response.json() as Promise<Record<string, RawLinearization[]>>
      })
      shard.catch(() => this.shards.delete(tense))
      this.shards.set(tense, shard)
    }
    return shard
  }
}

/** A complete term is `MkS <Temp> <Pol> (...)`; the Temp constructor names its shard. */
export const tenseOf = (term: string) => term.split(' ')[1]

export function createRuntime(): GfRuntime {
  return import.meta.env.VITE_GF_MODE === 'static' ? new StaticGfRuntime() : new HttpGfRuntime()
}
