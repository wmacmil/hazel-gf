// Parses off the main thread: GF's prediction over the German grammar takes
// ~1 s per clause-level parse, which would otherwise freeze typing. The app
// runs one of these per channel (the sentence box, the graft prompt), so
// neither waits behind the other.
import { loadBrowserGrammar, type BrowserGrammar } from './browser-gf'
import { LANGUAGE_IDS } from './languages'
import type { CategoryId } from './model'
import { finishPhrase, parseSentence, phraseState, phraseSteps, terminalsOf } from './parsing'

let ready: Promise<{ grammar: BrowserGrammar; terminals: Record<string, Set<string>> }> | undefined

type Request =
  | { id: number; url: string; kind?: 'sentence'; language: string; text: string }
  /** A phrase for a hole of sort `target` (any sort if absent), tried in every language. */
  | { id: number; url: string; kind: 'phrase'; text: string; target?: CategoryId }

/** A phrase request gets this long; then it answers with what it has found. */
const PHRASE_BUDGET_MS = 4000
/** Cheap languages first, so a budget cut costs the slow one (German). */
const PHRASE_ORDER = [...LANGUAGE_IDS].sort((a, b) => Number(a === 'HazelGFGer') - Number(b === 'HazelGFGer'))

/** Only the newest request matters: older ones still queued or running are dropped. */
let latest = 0
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data
  latest = request.id
  const stale = () => latest !== request.id
  ready ??= fetch(request.url).then(response => {
    if (!response.ok) throw new Error(`Could not load the grammar (${response.status})`)
    return response.json()
  }).then(json => ({
    grammar: loadBrowserGrammar(json),
    terminals: Object.fromEntries(LANGUAGE_IDS.map(language => [language, terminalsOf(json, language)])),
  }))
  try {
    const { grammar, terminals } = await ready
    // Let newer queued requests arrive first: then this one is already stale.
    await tick()
    if (stale()) { self.postMessage({ id: request.id, stale: true }); return }
    if (request.kind !== 'phrase') {
      self.postMessage({ id: request.id, result: parseSentence(grammar, request.language, request.text, terminals[request.language]) })
      return
    }
    const deadline = performance.now() + PHRASE_BUDGET_MS
    const state = phraseState()
    let truncated = false
    languages: for (const language of PHRASE_ORDER) {
      const steps = phraseSteps(grammar, language, request.text, terminals[language], request.target, state)
      while (!steps.next().done) {
        await tick()
        if (stale()) { self.postMessage({ id: request.id, stale: true }); return }
        if (performance.now() > deadline) { truncated = true; break languages }
      }
    }
    self.postMessage({ id: request.id, result: { readings: finishPhrase(state), truncated } })
  } catch (cause) {
    ready = undefined
    self.postMessage({ id: request.id, error: cause instanceof Error ? cause.message : String(cause) })
  }
}
