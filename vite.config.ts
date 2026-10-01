import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const commit = (process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'local'
  }
})()).slice(0, 8)
const buildTime = `${new Date().toISOString().slice(0, 16)}Z`

export default defineConfig({
  base: './',
  define: { __APP_BUILD_VERSION__: JSON.stringify(`${buildTime} · ${commit}`) },
  plugins: [react(), tailwindcss()],
})
