// Parses off the main thread: GF's prediction over the German grammar takes
// ~350 ms per parse, which would otherwise freeze typing.
import { loadBrowserGrammar, type BrowserGrammar } from './browser-gf'
import { LANGUAGE_IDS } from './languages'
import type { CategoryId } from './model'
import { parsePhrase, parseSentence, terminalsOf } from './parsing'

let ready: Promise<{ grammar: BrowserGrammar; terminals: Record<string, Set<string>> }> | undefined

type Request =
  | { id: number; url: string; kind?: 'sentence'; language: string; text: string }
  /** A phrase for a hole of sort `target` (any sort if absent), tried in every language. */
  | { id: number; url: string; kind: 'phrase'; text: string; target?: CategoryId }

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data
  ready ??= fetch(request.url).then(response => response.json()).then(json => ({
    grammar: loadBrowserGrammar(json),
    terminals: Object.fromEntries(LANGUAGE_IDS.map(language => [language, terminalsOf(json, language)])),
  }))
  try {
    const { grammar, terminals } = await ready
    const result = request.kind === 'phrase'
      ? LANGUAGE_IDS.flatMap(language => parsePhrase(grammar, language, request.text, terminals[language], request.target))
      : parseSentence(grammar, request.language, request.text, terminals[request.language])
    self.postMessage({ id: request.id, result })
  } catch (cause) {
    ready = undefined
    self.postMessage({ id: request.id, error: cause instanceof Error ? cause.message : String(cause) })
  }
}
