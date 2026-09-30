import type { CategoryId } from './model'
import type { ParseResult, PhraseReading } from './parsing'

/**
 * One parse worker per channel, so the sentence box never waits behind the
 * graft prompt (or the reverse). Within a channel only the newest request
 * matters: the worker drops older ones, and they reject as superseded. A
 * worker that fails to load, crashes, or runs past the hard limit is
 * terminated, its requests rejected, and a new one started on the next call:
 * "parsing…" can never hang.
 */
type Channel = 'sentence' | 'phrase'
type Waiting = { resolve: (result: never) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }

const HARD_LIMIT_MS = 20000
const workers: Partial<Record<Channel, { worker: Worker; pending: Map<number, Waiting> }>> = {}
let serial = 0

export class Superseded extends Error { constructor() { super('Superseded by a newer parse') } }

function fail(channel: Channel, message: string) {
  const entry = workers[channel]
  if (!entry) return
  delete workers[channel]
  entry.worker.terminate()
  for (const waiting of entry.pending.values()) { clearTimeout(waiting.timer); waiting.reject(new Error(message)) }
}

function start(channel: Channel) {
  const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, Waiting>()
  worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string; stale?: boolean }>) => {
    const waiting = pending.get(event.data.id)
    if (!waiting) return
    pending.delete(event.data.id)
    clearTimeout(waiting.timer)
    if (event.data.stale) waiting.reject(new Superseded())
    else if (event.data.error) waiting.reject(new Error(event.data.error))
    else waiting.resolve(event.data.result as never)
  }
  worker.onerror = event => { event.preventDefault(); fail(channel, `The parser stopped: ${event.message || 'worker error'}`) }
  worker.onmessageerror = () => fail(channel, 'The parser sent an unreadable answer')
  workers[channel] = { worker, pending }
  return workers[channel]!
}

function request<T>(channel: Channel, message: Record<string, unknown>): Promise<T> {
  const entry = workers[channel] ?? start(channel)
  const id = ++serial
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => fail(channel, 'Parsing took too long; try fewer words or no _'), HARD_LIMIT_MS)
    entry.pending.set(id, { resolve: resolve as (result: never) => void, reject, timer })
    entry.worker.postMessage({ id, url: `${location.origin}${import.meta.env.BASE_URL}HazelGF.json`, ...message })
  })
}

/** Parse `text` as a sentence of `language`; a superseded request rejects with Superseded. */
export const parseInWorker = (language: string, text: string) => request<ParseResult>('sentence', { kind: 'sentence', language, text })

/** Parse a phrase for a hole of sort `target` in every language (partial terms; `_` marks a hole). `truncated`: the time budget cut the search short. */
export const parsePhraseInWorker = (text: string, target: CategoryId | undefined) =>
  request<{ readings: PhraseReading[]; truncated: boolean }>('phrase', { kind: 'phrase', text, target })
