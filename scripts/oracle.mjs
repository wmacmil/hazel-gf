// Build the test oracle and the paradigm tables.
//
// oracle/: the GF *server's* bracketed linearization of every PP-free sentence
// plus a deterministic sample of sentences with prepositional phrases (the
// grammar is recursive, so not every tree can be listed), sharded by tense.
// Tests check the in-browser runtime (vendor/gf-typescript) against it; it is
// not shipped.
// public/static/paradigms.json: GF's `l -table` for every lexical leaf, and the
// case each preposition and transitive verb governs; shipped and used to
// split words into morphemes.
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pgf = resolve(appDir, 'public/HazelGF.pgf')
const outDir = resolve(appDir, 'oracle')
const staticDir = resolve(appDir, 'public/static')
const port = process.env.GF_PRECOMPUTE_PORT ?? '41399'
const languages = new Set(JSON.parse(readFileSync(resolve(appDir, 'languages.json'), 'utf8')).map(profile => profile.id))

const gfShell = input => execFileSync('gf', ['--run', pgf], { input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
const signature = gfShell('pg -funs\nq\n')
/** Nullary functions of a category, e.g. `SleepV : V ;`. */
const leaves = category => [...signature.matchAll(/^(\w+) : (\w+) ;$/gm)]
  .filter(([, name, output]) => output === category && !name.startsWith('Hole')).map(([, name]) => name)
const arg = term => term.includes(' ') ? `(${term})` : term

const temps = leaves('Temp'), pols = leaves('Pol'), preps = leaves('Prep')
// Built from the leaves, not `gt`: the grammar is recursive, and `gt` fills
// its budget with nested adverbials before listing the plain phrases.
const nps = [...leaves('Pron').map(pron => `UsePron ${pron}`),
  ...leaves('Det').flatMap(det => leaves('N').map(noun => `DetCN ${det} (UseN ${noun})`))]
const vps = [...leaves('V').map(verb => `UseV ${verb}`),
  ...leaves('V2').flatMap(verb => nps.map(np => `ComplV2 ${verb} (${np})`))]
// Every PP-free sentence: Temp × Pol × NP × VP.
const plain = temps.flatMap(t => pols.flatMap(p => nps.flatMap(np => vps.map(vp => `MkS ${t} ${p} (PredVP ${arg(np)} ${arg(vp)})`))))
// A deterministic PP sample: every preposition × every NP inside it, on a few
// clauses, tenses, and polarities, plus PPs modifying an object noun.
const ppClauses = [['UsePron IPron', 'UseV SleepV'], ['DetCN Definite (UseN ManN)', 'UseV WalkV'],
  ['UsePron ShePron', 'ComplV2 SeeV2 (UsePron HePron)']]
const withPP = ['Present', 'Past', 'PresentPerfect', 'FuturePerfect'].flatMap(t => pols.flatMap(p => ppClauses.flatMap(([subject, vp]) =>
  preps.flatMap(prep => nps.map(np => `MkS ${t} ${p} (PredVP (${subject}) (AdvVP (${vp}) (PrepNP ${prep} ${arg(np)})))`)))))
const withAdvCN = ['Present', 'PastPerfect'].flatMap(t => preps.flatMap(prep => nps.map(np =>
  `MkS ${t} Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (DetCN Definite (AdvCN (UseN WomanN) (PrepNP ${prep} ${arg(np)})))))`)))
const trees = [...new Set([...plain, ...withPP, ...withAdvCN])].sort()

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
  const tables = {}
  for (const language of languages) {
    const script = lexical.flatMap(name => [`ps "@@ ${name}"`, `l -table -lang=${language} ${name}`]).join('\n') + '\nq\n'
    const output = gfShell(script)
    const cells = (tables[language] = {})
    let current
    for (const line of output.split('\n')) {
      const marker = line.match(/^@@ (\w+)$/)
      if (marker) { current = cells[marker[1]] = {}; continue }
      const cell = line.match(/^s (.*?) : (.*)$/)
      if (current && cell && cell[2]) current[cell[1]] = cell[2]
    }
  }
  return { tables, government: government(tables) }
}

/**
 * The case each preposition and transitive verb governs. GF's tables do not
 * show this parameter, but it is observable through its exponent: govern a
 * pronoun and read which paradigm cell the pronoun's form comes from
 * (German mit + er → ihm = NPCase Dat).
 */
const CASE = /\b(Nom|Acc|Dat|Gen)\b|NP(Nom|Acc)/
function government(tables) {
  const result = {}
  for (const language of languages) {
    const pronoun = tables[language].HePron
    const probes = [
      ...preps.map(prep => [prep, `MkS Present Positive (PredVP (UsePron IPron) (AdvVP (UseV SleepV) (PrepNP ${prep} (UsePron HePron))))`]),
      ...leaves('V2').map(verb => [verb, `MkS Present Positive (PredVP (UsePron IPron) (ComplV2 ${verb} (UsePron HePron)))`]),
    ]
    const output = gfShell(probes.map(([, term]) => `l -lang=${language} ${term}`).join('\n') + '\nq\n').split('\n').filter(Boolean)
    result[language] = {}
    probes.forEach(([leaf], index) => {
      const words = output[index].split(/\s+/)
      const cells = Object.entries(pronoun).filter(([cell, form]) => words.includes(form) && !cell.includes('Poss'))
      const found = cells.map(([cell]) => cell.match(CASE)).find(Boolean)
      if (found) result[language][leaf] = found[1] ?? found[2]
    })
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
    writeFileSync(resolve(outDir, `linearizations-${tense}.json.gz`), gzipSync(JSON.stringify(table)))
  }
  mkdirSync(staticDir, { recursive: true })
  writeFileSync(resolve(staticDir, 'paradigms.json'), JSON.stringify(paradigms()))
  writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ shards: Object.keys(shards).sort(), trees: trees.length, plain: plain.length }))
  console.log(`oracle: ${plain.length} PP-free + ${trees.length - plain.length} PP sentences = ${trees.length} trees × ${languages.size} languages in ${Object.keys(shards).length} tense shards → oracle/`)
} finally {
  gf.kill('SIGTERM')
}
