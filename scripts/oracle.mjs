// Build the test oracle and the paradigm tables.
//
// oracle/: the GF *server's* bracketed linearization of every complete tree up
// to the enumeration depth, sharded by tense. Tests check the in-browser
// runtime (vendor/gf-typescript) against it; it is not shipped.
// public/static/paradigms.json: GF's `l -table` for every lexical leaf, shipped
// and used to split words into morphemes.
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pgf = resolve(appDir, 'public/HazelGF.pgf')
const outDir = resolve(appDir, 'oracle')
const staticDir = resolve(appDir, 'public/static')
const port = process.env.GF_PRECOMPUTE_PORT ?? '41399'
const languages = new Set(JSON.parse(readFileSync(resolve(appDir, 'languages.json'), 'utf8')).map(profile => profile.id))

const generated = execFileSync('gf', ['--run', pgf], {
  input: 'gt -cat=S -depth=8 -number=1000000\nq\n',
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const trees = [...new Set(generated.split('\n').map(line => line.trim())
  .filter(line => line.startsWith('MkS ') && !line.includes('Hole')))].sort()
if (!trees.length) throw new Error('gf generated no trees')

// Paradigm tables for every lexical leaf: GF's own form ↔ parameter-cell
// pairs (`l -table`). The editor segments words into stem + exponents
// against these, instead of hand-written splits.
const LEXICAL_CATEGORIES = new Set(['N', 'V', 'V2', 'Pron', 'Det'])
function paradigms() {
  const abstract = execFileSync('gf', ['--run', pgf], { input: 'pg -funs\nq\n', encoding: 'utf8' })
  // Nullary functions of a lexical category, e.g. `SleepV : V ;`.
  const lexical = [...abstract.matchAll(/^(\w+) : (\w+) ;$/gm)]
    .filter(([, name, category]) => LEXICAL_CATEGORIES.has(category) && !name.startsWith('Hole'))
    .map(([, name]) => name)
  const result = {}
  for (const language of languages) {
    const script = lexical.flatMap(name => [`ps "@@ ${name}"`, `l -table -lang=${language} ${name}`]).join('\n') + '\nq\n'
    const output = execFileSync('gf', ['--run', pgf], { input: script, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const tables = (result[language] = {})
    let current
    for (const line of output.split('\n')) {
      const marker = line.match(/^@@ (\w+)$/)
      if (marker) { current = tables[marker[1]] = {}; continue }
      const cell = line.match(/^s (.*?) : (.*)$/)
      if (current && cell && cell[2]) current[cell[1]] = cell[2]
    }
  }
  return result
}

const gf = spawn('gf', [`--server=${port}`, `--document-root=${resolve(appDir, 'public')}`], { stdio: 'ignore' })
const base = `http://127.0.0.1:${port}/HazelGF.pgf`

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(`${base}?command=grammar`)).ok) return } catch { /* not up yet */ }
    await new Promise(done => setTimeout(done, 200))
  }
  throw new Error('GF server did not start')
}

try {
  await waitForServer()
  const grammar = await (await fetch(`${base}?command=grammar`)).json()
  const shards = {}
  for (const tree of trees) {
    const tense = tree.split(' ')[1]
    const table = (shards[tense] ??= {})
    const response = await fetch(`${base}?${new URLSearchParams({ command: 'linearize', tree })}`)
    if (!response.ok) throw new Error(`linearize failed (${response.status}) for ${tree}`)
    const raw = await response.json()
    table[tree] = raw.filter(item => languages.has(item.to))
      .map(({ to, text, brackets }) => ({ to, text, brackets }))
    if (table[tree].length !== languages.size) throw new Error(`missing languages for ${tree}`)
  }
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'grammar.json'), JSON.stringify(grammar))
  for (const [tense, table] of Object.entries(shards)) {
    writeFileSync(resolve(outDir, `linearizations-${tense}.json`), JSON.stringify(table))
  }
  mkdirSync(staticDir, { recursive: true })
  writeFileSync(resolve(staticDir, 'paradigms.json'), JSON.stringify(paradigms()))
  writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ shards: Object.keys(shards).sort(), trees: trees.length }))
  console.log(`precomputed ${trees.length} trees × ${languages.size} languages in ${Object.keys(shards).length} tense shards → oracle/`)
} finally {
  gf.kill('SIGTERM')
}
