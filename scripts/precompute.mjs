// Precompute every complete S tree's GF linearization so the editor can run
// as a static site (GitHub Pages) with no GF server. The grammar has no
// recursion, so the set of complete trees is finite (2052 today).
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pgf = resolve(appDir, 'public/HazelGF.pgf')
const outDir = resolve(appDir, 'public/static')
const port = process.env.GF_PRECOMPUTE_PORT ?? '41399'
const languages = new Set(['HazelGFEng', 'HazelGFGer', 'HazelGFSwe'])

const generated = execFileSync('gf', ['--run', pgf], {
  input: 'gt -cat=S -depth=8 -number=1000000\nq\n',
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const trees = [...new Set(generated.split('\n').map(line => line.trim())
  .filter(line => line.startsWith('MkS ') && !line.includes('Hole')))].sort()
if (!trees.length) throw new Error('gf generated no trees')

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
  const table = {}
  for (const tree of trees) {
    const response = await fetch(`${base}?${new URLSearchParams({ command: 'linearize', tree })}`)
    if (!response.ok) throw new Error(`linearize failed (${response.status}) for ${tree}`)
    const raw = await response.json()
    table[tree] = raw.filter(item => languages.has(item.to))
      .map(({ to, text, brackets }) => ({ to, text, brackets }))
    if (table[tree].length !== languages.size) throw new Error(`missing languages for ${tree}`)
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'grammar.json'), JSON.stringify(grammar))
  writeFileSync(resolve(outDir, 'linearizations.json'), JSON.stringify(table))
  console.log(`precomputed ${trees.length} trees × ${languages.size} languages → public/static/`)
} finally {
  gf.kill('SIGTERM')
}
