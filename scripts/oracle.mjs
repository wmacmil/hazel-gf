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
const nouns = leaves('N'), dets = leaves('Det'), prons = leaves('Pron')
const verbs = leaves('V'), transitives = leaves('V2'), adjectives = leaves('A'), adverbs = leaves('Adv'), conjunctions = leaves('Conj')
// Built from the leaves, not `gt`: the grammar is recursive (PPs, adjectives,
// coordination), so the oracle is a stratified sample: each stratum below
// exercises one construction, crossed with the tenses and polarities it touches.
const nps = [...prons.map(pron => `UsePron ${pron}`), ...dets.flatMap(det => nouns.map(noun => `DetCN ${det} (UseN ${noun})`))]
const subjects = ['UsePron IPron', 'UsePron HePron', 'DetCN Definite (UseN ManN)', 'DetCN EveryDet (UseN WomanN)']
const sentence = (tense, pol, clause) => `MkS ${tense} ${pol} (${clause})`
const pred = (np, vp) => `PredVP ${arg(np)} ${arg(vp)}`
const adjCN = (det, adjective, noun) => `DetCN ${det} (AdjCN (PositA ${adjective}) (UseN ${noun}))`
const strata = {
  // Every subject with every intransitive verb, in every tense and polarity.
  core: temps.flatMap(t => pols.flatMap(p => nps.flatMap(np => verbs.map(v => sentence(t, p, pred(np, `UseV ${v}`)))))),
  // Transitive objects, including the dative-governing HelpV2.
  objects: [['Present', 'Positive'], ['Past', 'Positive'], ['PresentPerfect', 'Positive'], ['Present', 'Negative']].flatMap(([t, p]) =>
    subjects.flatMap(subject => transitives.flatMap(v => nps.map(np => sentence(t, p, pred(subject, `ComplV2 ${v} ${arg(np)}`)))))),
  // Attributive adjectives as subject and object; degree; predicative adjectives.
  attributive: ['Present', 'Past'].flatMap(t => pols.flatMap(p => dets.flatMap(d => adjectives.flatMap(a => nouns.map(n => sentence(t, p, pred(adjCN(d, a, n), 'UseV SleepV'))))))),
  adjectiveObjects: dets.flatMap(d => adjectives.flatMap(a => nouns.map(n => sentence('Present', 'Positive', pred('UsePron IPron', `ComplV2 SeeV2 (${adjCN(d, a, n)})`))))),
  degree: dets.flatMap(d => adjectives.flatMap(a => ['ManN', 'WomanN', 'HouseN'].map(n =>
    sentence('Present', 'Positive', pred(`DetCN ${d} (AdjCN (AdAP VeryAdA (PositA ${a})) (UseN ${n}))`, 'UseV SleepV'))))),
  predicative: temps.flatMap(t => pols.flatMap(p => [...prons.map(pron => `UsePron ${pron}`), ...nouns.map(n => `DetCN Definite (UseN ${n})`)]
    .flatMap(subject => adjectives.map(a => sentence(t, p, pred(subject, `UseAP (PositA ${a})`)))))),
  // Existentials: there is / es gibt / det finns.
  existential: [...temps.flatMap(t => pols.flatMap(p => nps.map(np => sentence(t, p, `ExistNP ${arg(np)}`)))),
    ...pols.flatMap(p => adjectives.flatMap(a => nouns.map(n => sentence('Present', p, `ExistNP (${adjCN('Indefinite', a, n)})`))))],
  adverbs: ['Present', 'Past', 'PresentPerfect'].flatMap(t => pols.flatMap(p => subjects.flatMap(subject =>
    ['UseV WalkV', 'ComplV2 SeeV2 (UsePron HePron)'].flatMap(vp => adverbs.map(adv => sentence(t, p, pred(subject, `AdvVP (${vp}) ${adv}`))))))),
  // Prepositional phrases on the verb phrase and on an object noun.
  prepositions: [['Present', 'Positive'], ['PresentPerfect', 'Positive'], ['Past', 'Negative']].flatMap(([t, p]) =>
    [['UsePron IPron', 'UseV SleepV'], ['DetCN Definite (UseN ManN)', 'UseV WalkV'], ['UsePron ShePron', 'ComplV2 SeeV2 (UsePron HePron)']]
      .flatMap(([subject, vp]) => preps.flatMap(prep => nps.map(np => sentence(t, p, pred(subject, `AdvVP (${vp}) (PrepNP ${prep} ${arg(np)})`)))))),
  nounModifiers: ['Present', 'PastPerfect'].flatMap(t => preps.flatMap(prep => nps.map(np =>
    sentence(t, 'Positive', pred('UsePron IPron', `ComplV2 SeeV2 (DetCN Definite (AdvCN (UseN WomanN) (PrepNP ${prep} ${arg(np)})))`))))),
  // Coordination of noun phrases (subject and object) and of sentences.
  conjoinedNPs: ['Present', 'Past'].flatMap(t => conjunctions.flatMap(c => nps.slice(0, 10).flatMap(x => nps.slice(6, 16).map(y =>
    sentence(t, 'Positive', pred(`ConjNP ${c} ${arg(x)} ${arg(y)}`, 'UseV SwimV')))))),
  conjoinedObjects: conjunctions.flatMap(c => nps.slice(0, 8).flatMap(x => nps.slice(6, 14).map(y =>
    sentence('Present', 'Positive', pred('UsePron IPron', `ComplV2 SeeV2 (ConjNP ${c} ${arg(x)} ${arg(y)})`))))),
  conjoinedSentences: conjunctions.flatMap(c => subjects.flatMap(x => verbs.flatMap(v => subjects.map(y =>
    `ConjS ${c} (${sentence('Present', 'Positive', pred(x, `UseV ${v}`))}) (${sentence('Past', 'Negative', pred(y, 'UseV RunV'))})`)))),
}
const plain = strata.core
const trees = [...new Set(Object.values(strata).flat())].sort()

// Paradigm tables for every lexical leaf: GF's own form ↔ parameter-cell
// pairs (`l -table`). The editor segments words into stem + exponents
// against these, instead of hand-written splits.
const LEXICAL_CATEGORIES = new Set(['N', 'V', 'V2', 'Pron', 'Det', 'A'])
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
      ['ExistNP', 'MkS Present Positive (ExistNP (UsePron HePron))'],
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
    // Sharded by the first clause's tense.
    const tense = tree.match(/MkS (\w+)/)[1]
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
  writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ shards: Object.keys(shards).sort(), trees: trees.length, strata: Object.fromEntries(Object.entries(strata).map(([name, list]) => [name, list.length])) }))
  console.log(`oracle: ${trees.length} trees (${Object.entries(strata).map(([name, list]) => `${name} ${list.length}`).join(', ')}) × ${languages.size} languages in ${Object.keys(shards).length} tense shards → oracle/`)
} finally {
  gf.kill('SIGTERM')
}
