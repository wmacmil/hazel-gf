// Shared by the tests: the GF-server oracle (scripts/oracle.mjs) and the shipped paradigm tables.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { Paradigms } from './morphology'
import type { RawLinearization } from './projection'

const app = resolve(__dirname, '../..')
const shards = new Map<string, Record<string, RawLinearization[]>>()

/** { shards: tense names, trees: all oracle trees, plain: the PP-free ones }. */
export const oracleIndex = JSON.parse(readFileSync(resolve(app, 'oracle/index.json'), 'utf8')) as { shards: string[]; trees: number; plain: number }

export function oracleShard(tense: string): Record<string, RawLinearization[]> {
  if (!shards.has(tense)) {
    shards.set(tense, JSON.parse(gunzipSync(readFileSync(resolve(app, `oracle/linearizations-${tense}.json.gz`))).toString('utf8')))
  }
  return shards.get(tense)!
}

export const oracleTable = (): Record<string, RawLinearization[]> => Object.assign({}, ...oracleIndex.shards.map(oracleShard))

export const paradigms = JSON.parse(readFileSync(resolve(app, 'public/static/paradigms.json'), 'utf8')) as Paradigms

export const grammarJson = () => JSON.parse(readFileSync(resolve(app, 'public/HazelGF.json'), 'utf8'))
