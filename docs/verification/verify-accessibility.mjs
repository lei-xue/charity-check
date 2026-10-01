import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM || new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const records = JSON.parse(await readFile(`${root}/src/data/charities.json`, 'utf8'))
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
const report = { mode: 'Built production files via static browser route interception; no production server or mocked API', records: records.length, tags, scans: 0, incomplete: [], violations: [], pageErrors: [] }
const browser = await chromium.launch({ headless: true })

try {
  for (const width of [320, 390, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== 'https://charitycheck.test') return route.abort()
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1)
      const file = path.resolve(root, 'dist', relative)
      if (!file.startsWith(`${root}/dist/`)) return route.abort()
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' }
      try {
        await route.fulfill({ status: 200, body: await readFile(file), contentType: types[path.extname(file)] || 'application/octet-stream' })
      } catch {
        await route.fulfill({ status: 404, body: 'Not found' })
      }
    })
    const page = await context.newPage()
    page.on('pageerror', error => report.pageErrors.push(error.message))
    const audit = async (url) => {
      await page.goto(`https://charitycheck.test/${url}`)
      if (url === '') {
        const footer = await page.locator('footer').innerText()
        assert.match(footer, /Version: [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}Z · [0-9a-f]{8}/i)
      }
      const result = await new AxeBuilder({ page }).withTags(tags).analyze()
      report.scans++
      if (result.incomplete.length) report.incomplete.push({ width, url, rules: result.incomplete.map(rule => ({ id: rule.id, nodes: rule.nodes.map(node => ({ target: node.target, html: node.html, summary: node.failureSummary })) })) })
      for (const violation of result.violations) report.violations.push({ width, url, id: violation.id, impact: violation.impact, targets: violation.nodes.map(node => node.target) })
    }

    await audit('')
    await audit('#/browse')
    if (width === 320) {
      await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('zzzz-no-match')
      await page.getByText('No charities match your filters.', { exact: true }).waitFor()
      const result = await new AxeBuilder({ page }).withTags(tags).analyze()
      report.scans++
      if (result.incomplete.length) report.incomplete.push({ width, url: '#/browse (empty)', rules: result.incomplete.map(rule => ({ id: rule.id, nodes: rule.nodes.map(node => ({ target: node.target, html: node.html, summary: node.failureSummary })) })) })
      for (const violation of result.violations) report.violations.push({ width, url: '#/browse (empty)', id: violation.id, impact: violation.impact, targets: violation.nodes.map(node => node.target) })
    }
    await audit('#/about')
    await audit('#/org/530196605')
    if (width === 390) {
      for (const org of records) await audit(`#/org/${org.ein}`)
    }
    await context.close()
  }

  assert.deepEqual(report.violations, [], 'automated accessibility audit found WCAG/best-practice violations')
  assert.deepEqual(report.pageErrors, [], 'browser page errors occurred during accessibility audit')
  const output = path.join(root, 'docs/verification/accessibility-verification.json')
  await writeFile(output, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ scans: report.scans, records: report.records, violations: report.violations.length, incomplete: report.incomplete.length, pageErrors: report.pageErrors.length, report: output }))
} finally {
  await browser.close()
}
