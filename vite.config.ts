import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string

export default defineConfig({
  base: './',
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(`${buildTime} · ${commit}`),
    __APP_PACKAGE_VERSION__: JSON.stringify(packageVersion),
  },
  plugins: [react(), tailwindcss()],
})
