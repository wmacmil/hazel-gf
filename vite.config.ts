import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [svelte()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/HazelGF.pgf': 'http://127.0.0.1:41296',
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
