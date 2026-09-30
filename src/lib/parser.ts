import type { CategoryId } from './model'
import type { ParseResult, PhraseReading } from './parsing'

let worker: Worker | undefined
let serial = 0
const pending = new Map<number, { resolve: (result: never) => void; reject: (error: Error) => void }>()

function request<T>(message: Record<string, unknown>): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const waiting = pending.get(event.data.id)
      pending.delete(event.data.id)
      if (event.data.error) waiting?.reject(new Error(event.data.error))
      else waiting?.resolve(event.data.result as never)
    }
  }
  const id = ++serial
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (result: never) => void, reject })
    worker!.postMessage({ id, url: `${location.origin}${import.meta.env.BASE_URL}HazelGF.json`, ...message })
  })
}

/** Parse `text` as a sentence of `language` in a worker; only the latest request's answer matters to callers. */
export const parseInWorker = (language: string, text: string) => request<ParseResult>({ kind: 'sentence', language, text })

/** Parse a phrase for a hole of sort `target` in every language (partial terms; `_` marks a hole). */
export const parsePhraseInWorker = (text: string, target: CategoryId | undefined) => request<PhraseReading[]>({ kind: 'phrase', text, target })
