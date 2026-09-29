// Linearize every language profile's smoke terms with the GF shell and compare
// against the goldens declared in languages.json.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profiles = JSON.parse(readFileSync(resolve(appDir, 'languages.json'), 'utf8'))
let failures = 0
for (const profile of profiles) {
  for (const { term, text } of profile.smoke) {
    const output = execFileSync('gf', ['--run', resolve(appDir, 'public/HazelGF.pgf')], {
      input: `l -lang=${profile.id} ${term}\nq\n`, encoding: 'utf8',
    }).trim()
    const ok = output === text
    if (!ok) failures++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${profile.id}: ${output}${ok ? '' : `   (expected: ${text})`}`)
  }
}
process.exit(failures ? 1 : 0)
