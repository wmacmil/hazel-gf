import type { ParseResult } from './parsing'

let worker: Worker | undefined
let serial = 0
const pending = new Map<number, { resolve: (result: ParseResult) => void; reject: (error: Error) => void }>()

/** Parse `text` as a sentence of `language` in a worker; only the latest request's answer matters to callers. */
export function parseInWorker(language: string, text: string): Promise<ParseResult> {
  if (!worker) {
    worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; result?: ParseResult; error?: string }>) => {
      const request = pending.get(event.data.id)
      pending.delete(event.data.id)
      if (event.data.error) request?.reject(new Error(event.data.error))
      else if (event.data.result) request?.resolve(event.data.result)
    }
  }
  const id = ++serial
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker!.postMessage({ id, url: `${location.origin}${import.meta.env.BASE_URL}HazelGF.json`, language, text })
  })
}
