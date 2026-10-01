import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatEin, formatMoney, formatTaxPeriod } from '../../src/lib/status.ts'

const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM || new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const output = process.env.BROWSER_OUTPUT || path.dirname(fileURLToPath(import.meta.url))
const records = JSON.parse(await readFile(`${root}/src/data/charities.json`, 'utf8'))
const checks = []
const errors = []
const externalRequests = []
const check = (name, actual, expected = true) => {
  assert.deepEqual(actual, expected, name)
  checks.push(name)
}

// Serve the actual built files by browser route interception. No mock API
// responses, no claimed production deployment and no listening HTTP server.
const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, timezoneId: 'Pacific/Auckland' })
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== 'https://charitycheck.test') {
        externalRequests.push(route.request().url())
        return route.abort()
      }
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1)
      const file = path.resolve(root, 'dist', relative)
      if (!file.startsWith(`${root}/dist/`)) return route.abort()
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
      try {
        await route.fulfill({ status: 200, body: await readFile(file), contentType: types[path.extname(file)] || 'application/octet-stream' })
      } catch {
        await route.fulfill({ status: 404, body: 'Not found' })
      }
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('https://charitycheck.test/')
    await page.getByRole('heading', { name: 'Check before you give.', exact: true }).waitFor()
    check(`${viewport.width}: English document`, await page.locator('html').getAttribute('lang'), 'en')
    check(`${viewport.width}: snapshot date is stable across timezones`, await page.getByText(/Snapshot of public records taken September 20, 2026/).count(), 1)
    check(`${viewport.width}: metadata does not certify current IRS status`, !(await page.locator('meta[name="description"]').getAttribute('content')).includes('verify a charity'))
    const navigate = async (hash, heading) => {
      await page.evaluate(hash => { window.location.hash = hash }, hash)
      await page.getByRole('heading', { name: heading, exact: true }).waitFor()
    }
    await navigate('/browse', 'Browse charities')
    check(`${viewport.width}: all real records appear in browse`, await page.locator('a[href^="#/org/"]').count(), records.length)
    check(`${viewport.width}: browse has no unsupported source badges`, !(await page.locator('main').innerText()).match(/\bVerified\b|Public Charity/))
    const leading = records.find(org => String(org.ein).length < 9)
    for (const query of [formatEin(leading.ein), String(leading.ein).padStart(9, '0'), String(leading.ein)]) {
      await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(query)
      await page.waitForFunction(() => document.querySelectorAll('a[href^="#/org/"]').length === 1)
      check(`${viewport.width}: leading-zero search ${query}`, await page.locator('a[href^="#/org/"]').getAttribute('href'), `#/org/${leading.ein}`)
    }
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(`abc${leading.ein}`)
    await page.getByText('No charities match your filters.', { exact: true }).waitFor()
    check(`${viewport.width}: embedded digits do not become EIN matches`, await page.locator('a[href^="#/org/"]').count(), 0)

    for (const org of records) {
      await navigate(`/org/${org.ein}`, org.name)
      const text = await page.locator('main').innerText()
      check(`${viewport.width}: detail preserves source EIN ${org.ein}`, text.includes(`EIN ${formatEin(org.ein)}`))
      check(`${viewport.width}: detail snapshot date ${org.ein}`, text.includes('Snapshot captured September 20, 2026'))
      if (org.latestFiling) {
        check(`${viewport.width}: historical filing period ${org.ein}`, text.includes(`tax period ${formatTaxPeriod(org.latestFiling.taxPeriod)}`))
        for (const [label, key] of [['Total revenue', 'totalRevenue'], ['Total expenses', 'totalExpenses'], ['Total assets (year end)', 'totalAssets']]) {
          const value = org.latestFiling[key]
          const expected = value === null || value === undefined ? 'Not reported' : formatMoney(value)
          check(`${viewport.width}: ${org.ein} ${label}`, await page.getByText(label, { exact: true }).locator('..').locator('dd').innerText(), expected)
        }
      } else {
        check(`${viewport.width}: missing filing is not wrongdoing ${org.ein}`, text.includes('not a finding of fraud'))
      }
      check(`${viewport.width}: source profile link ${org.ein}`, await page.getByRole('link', { name: 'View on ProPublica Nonprofit Explorer', exact: true }).getAttribute('href'), `https://projects.propublica.org/nonprofits/organizations/${org.ein}`)
      check(`${viewport.width}: detail has no horizontal overflow ${org.ein}`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    }

    for (const ein of [formatEin(leading.ein), String(leading.ein).padStart(9, '0')]) {
      await navigate(`/org/${ein}`, leading.name)
      check(`${viewport.width}: canonical leading-zero route ${ein}`, await page.getByRole('heading', { name: leading.name, exact: true }).count(), 1)
    }
    for (const ein of ['abc530196605', '12-34', '5301966050', '000000000', '530196605.0', '00422630']) {
      await navigate(`/org/${ein}`, 'Invalid EIN in this link')
      check(`${viewport.width}: malformed route remains invalid ${ein}`, await page.getByRole('heading', { name: 'Invalid EIN in this link', exact: true }).count(), 1)
    }
    const input = page.getByRole('textbox', { name: 'EIN or organization name', exact: true })
    for (const query of ['1234567', '53 0196605', '530196605.0', '1.2e8', '000000000']) {
      await input.fill(query)
      await page.getByRole('button', { name: 'Look up', exact: true }).click()
      await page.getByRole('alert').waitFor()
      check(`${viewport.width}: invalid EIN has accessible feedback ${query}`, await input.getAttribute('aria-invalid'), 'true')
    }
    await navigate('/org/999999999', 'Not in the curated dataset')
    const observedPrefill = await page.getByRole('textbox', { name: 'EIN or organization name' }).inputValue()
    if (observedPrefill !== '99-9999999') {
      await page.reload()
      await page.getByRole('heading', { name: 'Not in the curated dataset', exact: true }).waitFor()
      console.log(JSON.stringify({ diagnostic: 'SPA transition vs fresh mount', spaInput: observedPrefill, freshInput: await page.getByRole('textbox', { name: 'EIN or organization name' }).inputValue() }))
    }
    check(`${viewport.width}: unknown canonical EIN stays optional`, observedPrefill, '99-9999999')
    await navigate('/about', 'About CharityCheck')
    check(`${viewport.width}: transfer and partial-search limits disclosed`, (await page.locator('main').innerText()).includes('at most five matches'))
    check(`${viewport.width}: no Chinese or language switch in rendered pages`, !(await page.locator('body').innerText()).match(/[\u3400-\u9fff]|Español|Language switch/))
    check(`${viewport.width}: no About horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    if (process.env.BROWSER_SCREENSHOTS) {
      await mkdir(output, { recursive: true })
      await page.screenshot({ path: `${output}/charitycheck-about-${viewport.width}.png`, fullPage: true })
    }
    await context.close()
  }
  check('local browsing, malformed routes and invalid EINs send no third-party requests', externalRequests, [])
  check('no browser page errors', errors, [])
  const result = { mode: 'Built production files in Chromium through static route interception; no production server or mocked API responses', records: records.length, viewports: [390, 1440], checks: checks.length, failed: 0, externalRequests, errors, assertions: checks }
  await mkdir(output, { recursive: true })
  await writeFile(`${output}/browser-verification.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ records: result.records, viewports: result.viewports, checks: result.checks, failed: result.failed, externalRequests: result.externalRequests, errors: result.errors }))
} finally {
  await browser.close()
}
