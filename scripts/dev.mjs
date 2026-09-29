import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gf = spawn('gf', ['--server=41296', `--document-root=${resolve(appDir, 'public')}`], {
  cwd: appDir,
  stdio: 'inherit',
})
const vite = spawn('vite', [], { cwd: appDir, stdio: 'inherit' })

function stop(signal = 'SIGTERM') {
  gf.kill(signal)
  vite.kill(signal)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
gf.on('exit', code => {
  if (code && !vite.killed) vite.kill('SIGTERM')
})
vite.on('exit', code => {
  if (!gf.killed) gf.kill('SIGTERM')
  process.exitCode = code ?? 0
})
