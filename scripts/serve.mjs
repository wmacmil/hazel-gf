import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = process.env.PORT ?? '8043'
const gf = spawn('gf', [`--server=${port}`, `--document-root=${resolve(appDir, 'dist')}`], {
  cwd: appDir,
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => gf.kill(signal))
}
gf.on('exit', code => { process.exitCode = code ?? 0 })
