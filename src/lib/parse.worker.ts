// Parses off the main thread: GF's prediction over the German grammar takes
// ~350 ms per parse, which would otherwise freeze typing.
import { loadBrowserGrammar, type BrowserGrammar } from './browser-gf'
import { LANGUAGE_IDS } from './languages'
import { parseSentence, terminalsOf } from './parsing'

let ready: Promise<{ grammar: BrowserGrammar; terminals: Record<string, Set<string>> }> | undefined

self.onmessage = async (event: MessageEvent<{ id: number; url: string; language: string; text: string }>) => {
  const { id, url, language, text } = event.data
  ready ??= fetch(url).then(response => response.json()).then(json => ({
    grammar: loadBrowserGrammar(json),
    terminals: Object.fromEntries(LANGUAGE_IDS.map(language => [language, terminalsOf(json, language)])),
  }))
  try {
    const { grammar, terminals } = await ready
    self.postMessage({ id, result: parseSentence(grammar, language, text, terminals[language]) })
  } catch (cause) {
    ready = undefined
    self.postMessage({ id, error: cause instanceof Error ? cause.message : String(cause) })
  }
}
