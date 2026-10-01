// Renders the original 1200x630 social card SVG to public/og-image.png with the
// Playwright installation that is already available on this machine. No
// dependency is added to this project's manifest; point PLAYWRIGHT_REQUIRE_FROM
// at a package.json whose project has Playwright installed when the default
// local resolution cannot find it.
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM || new URL('../package.json', import.meta.url))
const { chromium } = require('playwright')

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const source = process.env.SOCIAL_CARD_SVG || path.join(root, 'scripts/brand/social-card.svg')
const target = process.env.SOCIAL_CARD_OUT || path.join(root, 'public/og-image.png')
const width = 1200
const height = 630

const svg = await readFile(source, 'utf8')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#faf7f0}</style></head><body>${svg}</body></html>`,
    { waitUntil: 'load' },
  )
  await page.screenshot({ path: target, type: 'png' })
} finally {
  await browser.close()
}

// Read the PNG IHDR back so a wrong viewport cannot silently ship.
const png = await readFile(target)
const signature = png.subarray(0, 8).toString('hex')
if (signature !== '89504e470d0a1a0a') throw new Error(`not a PNG: ${target}`)
const actualWidth = png.readUInt32BE(16)
const actualHeight = png.readUInt32BE(20)
if (actualWidth !== width || actualHeight !== height) {
  throw new Error(`expected ${width}x${height}, rendered ${actualWidth}x${actualHeight}`)
}
console.log(JSON.stringify({ source: path.relative(root, source), target: path.relative(root, target), width: actualWidth, height: actualHeight, bytes: png.length }))
