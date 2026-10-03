// Local dev-only browser regression check for pagination focus/scroll and
// clear-filter focus restoration. Not shipped: run manually against a local
// preview, e.g.
//   PREVIEW_URL=http://127.0.0.1:8803 node scripts/browse-focus-regression.mjs
// Uses the sibling project's already-installed Playwright (read-only import);
// nothing is written outside this repository.
import { createRequire } from 'node:module'

const require = createRequire('/root/repo-audit/mindbridge-emil-audit/package.json')
const { chromium } = require('playwright')

const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:8803'
const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

// 1. Explicit Next click: focus + scroll move to the labelled result summary.
await page.goto(`${base}/#/browse`, { waitUntil: 'networkidle' })
await page.locator('button', { hasText: 'Next' }).first().click()
await page.waitForURL(/page=2/)
await page.waitForSelector('text=Page 2 of')
const focus = await page.evaluate(() => {
  const el = document.activeElement
  return { tag: el?.tagName, role: el?.getAttribute('role'), text: el?.textContent?.slice(0, 40) }
})
check('Next click focuses result summary (not body/next button)', focus.role === 'status', JSON.stringify(focus))
const geom = await page.evaluate(() => {
  const summary = document.querySelector('p[role="status"]')
  const header = document.querySelector('header')
  const top = summary.getBoundingClientRect().top
  return { top, headerBottom: header.getBoundingClientRect().bottom, scrollY: window.scrollY }
})
check(
  'Summary scrolled just below sticky header',
  geom.top >= geom.headerBottom - 1 && geom.top < geom.headerBottom + 40 && geom.scrollY > 0,
  JSON.stringify(geom),
)
const url = page.url()
check('Page URL is shareable (?page=2)', url.includes('page=2'), url)
// Next Tab from the summary should reach a record link, not the pagination.
await page.keyboard.press('Tab')
const tabTag = await page.evaluate(() => document.activeElement?.tagName)
check('Tab after summary reaches page content', tabTag === 'A', `active=${tabTag}`)

// 2. Clear all filters from a zero-result search restores focus to #filter-q.
await page.goto(`${base}/#/browse`, { waitUntil: 'networkidle' })
await page.fill('#filter-q', 'zzz-no-such-charity-zzz')
await page.waitForSelector('text=No charities match your filters.')
await page.locator('button', { hasText: 'Clear all filters' }).click()
await page.waitForSelector('#filter-q')
const clearFocus = await page.evaluate(() => document.activeElement?.id)
check('Clear all filters restores focus to #filter-q', clearFocus === 'filter-q', `active=${clearFocus}`)
const clearedUrl = page.url()
check('Clearing filters resets URL params', !clearedUrl.includes('q='), clearedUrl)

// 2b. Inline "Clear filters" button (beside the summary) also restores focus.
await page.goto(`${base}/#/browse`, { waitUntil: 'networkidle' })
await page.fill('#filter-q', 'Red Cross')
await page.waitForSelector('button:has-text("Clear filters")')
await page.locator('button', { hasText: 'Clear filters' }).first().click()
await page.waitForSelector('text=Page 1 of')
const inlineClearFocus = await page.evaluate(() => document.activeElement?.id)
check('Inline Clear filters restores focus to #filter-q', inlineClearFocus === 'filter-q', `active=${inlineClearFocus}`)

// 2c. Next -> zero-result filter -> clear -> Next to the same page again:
// the repeat pagination is a genuine user action and must re-focus the summary.
await page.goto(`${base}/#/browse`, { waitUntil: 'networkidle' })
await page.locator('button', { hasText: 'Next' }).first().click()
await page.waitForURL(/page=2/)
await page.waitForSelector('text=Page 2 of')
await page.fill('#filter-q', 'nonexistent-synthetic-organization')
await page.waitForSelector('text=No charities match your filters.')
await page.locator('button', { hasText: 'Clear all filters' }).click()
await page.waitForURL((u) => !u.hash.includes('page='))
await page.waitForSelector('text=Page 1 of')
await page.locator('button', { hasText: 'Next' }).first().click()
await page.waitForURL(/page=2/)
await page.waitForSelector('text=Page 2 of')
const repeatFocus = await page.evaluate(() => document.activeElement?.getAttribute('role'))
check('Repeat Next after filter clear re-focuses summary', repeatFocus === 'status', `role=${repeatFocus}`)

// 3. Typing in the filter keeps focus and fires no remote requests.
await page.goto(`${base}/#/browse`, { waitUntil: 'networkidle' })
const remote = []
page.on('request', (req) => {
  if (!req.url().startsWith(base)) remote.push(req.url())
})
await page.focus('#filter-q')
await page.type('#filter-q', 'hav')
const typeFocus = await page.evaluate(() => document.activeElement?.id)
check('Typing keeps focus in #filter-q', typeFocus === 'filter-q', `active=${typeFocus}`)
check('Typing fires no remote API requests', remote.length === 0, `${remote.length} remote request(s)`)

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
