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
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' }
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
    check(`${viewport.width}: dataset-generation date is stable across timezones`, await page.getByText(/Dataset snapshot generated October 1, 2026/).count(), 1)
    check(`${viewport.width}: metadata does not certify current IRS status`, !(await page.locator('meta[name="description"]').getAttribute('content')).includes('verify a charity'))
    check(`${viewport.width}: cream canvas`, await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(250, 247, 240)')
    check(`${viewport.width}: burgundy search button`, await page.getByRole('button', { name: 'Search', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(146, 44, 78)')
    check(`${viewport.width}: no home overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    if (process.env.BROWSER_SCREENSHOTS) {
      await mkdir(output, { recursive: true })
      await page.screenshot({ path: `${output}/charitycheck-home-${viewport.width}.png`, fullPage: true })
    }
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
      check(`${viewport.width}: detail dataset-generation date ${org.ein}`, text.includes('Dataset snapshot generated October 1, 2026'))
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
    check(`${viewport.width}: transfer and partial-search limits disclosed`, (await page.locator('main').innerText()).includes('10,000 matches') && (await page.locator('main').innerText()).includes('Cloudflare and ProPublica'))
    check(`${viewport.width}: no Chinese or language switch in rendered pages`, !(await page.locator('body').innerText()).match(/[\u3400-\u9fff]|Español|Language switch/))
    check(`${viewport.width}: no About horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    if (process.env.BROWSER_SCREENSHOTS) {
      await mkdir(output, { recursive: true })
      await page.screenshot({ path: `${output}/charitycheck-about-${viewport.width}.png`, fullPage: true })
    }
    await context.close()
  }

  // Layout and metadata regression at the widths that previously overflowed
  // (header at 320px) or misaligned (desktop filter row). Same intercepted
  // production build; still no listening server and no mocked responses.
  const layoutViewports = [320, 390, 768, 1024, 1440]
  const controlBaseline = {}
  const serveDist = async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'https://charitycheck.test') {
      externalRequests.push(route.request().url())
      return route.abort()
    }
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1)
    const file = path.resolve(root, 'dist', relative)
    if (!file.startsWith(`${root}/dist/`)) return route.abort()
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' }
    try {
      await route.fulfill({ status: 200, body: await readFile(file), contentType: types[path.extname(file)] || 'application/octet-stream' })
    } catch {
      await route.fulfill({ status: 404, body: 'Not found' })
    }
  }
  for (const width of layoutViewports) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('**/*', serveDist)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('https://charitycheck.test/')
    await page.getByRole('heading', { name: 'Check before you give.', exact: true }).waitFor()

    check(`${width}: built page ships exactly one title element`, await page.locator('title').count(), 1)
    check(`${width}: built title matches the source title`, await page.title(), 'CharityCheck — public nonprofit records and Form 990 figures')
    check(`${width}: built canonical URL`, await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://charitycheck.leixue.dev/')
    check(`${width}: built og:image is the production PNG`, await page.locator('meta[property="og:image"]').getAttribute('content'), 'https://charitycheck.leixue.dev/og-image.png')
    check(`${width}: built theme colour`, await page.locator('meta[name="theme-color"]').getAttribute('content'), '#922c4e')

    const favicon = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="icon"]')
      const href = link ? link.getAttribute('href') : null
      if (!href) return { href, status: 0, type: null }
      const response = await fetch(href)
      return { href, status: response.status, type: response.headers.get('content-type') }
    })
    check(`${width}: favicon link points at the SVG asset`, typeof favicon.href === 'string' && favicon.href.endsWith('favicon.svg'))
    check(`${width}: favicon asset is served`, favicon.status, 200)
    check(`${width}: favicon asset is an SVG`, favicon.type, 'image/svg+xml')

    const social = await page.evaluate(async () => {
      const img = new Image()
      img.src = '/og-image.png'
      await img.decode()
      return { width: img.naturalWidth, height: img.naturalHeight }
    })
    check(`${width}: built social card is 1200x630`, [social.width, social.height], [1200, 630])

    check(`${width}: home has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    const header = page.locator('header')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    check(`${width}: header stays sticky`, await header.evaluate(el => getComputedStyle(el).position), 'sticky')
    check(`${width}: header does not overflow`, await header.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    check(`${width}: header keeps three navigation links`, await nav.getByRole('link').count(), 3)
    for (const name of ['Home', 'Browse', 'About']) {
      check(`${width}: header link ${name} is visible`, await nav.getByRole('link', { name, exact: true }).isVisible())
    }

    await page.evaluate(() => { window.location.hash = '/browse' })
    await page.getByRole('heading', { name: 'Browse charities', exact: true }).waitFor()
    check(`${width}: browse has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

    const controls = await page.evaluate(() =>
      ['filter-q', 'filter-state', 'filter-cause', 'filter-min', 'filter-max'].map(id => {
        const el = document.getElementById(id)
        const rect = el.getBoundingClientRect()
        return { id, top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width), minWidth: getComputedStyle(el).minWidth }
      }),
    )
    for (const control of controls) {
      check(`${width}: ${control.id} keeps the 40px control height`, control.height, 40)
      check(`${width}: ${control.id} can shrink inside its grid cell`, control.minWidth, '0px')
    }
    const labels = await page.evaluate(() =>
      ['filter-min', 'filter-max'].map(id => {
        const el = document.querySelector(`label[for="${id}"]`)
        const rect = el.getBoundingClientRect()
        return { id, height: Math.round(rect.height) }
      }),
    )
    for (const label of labels) {
      check(`${width}: ${label.id} label stays on one 16px line`, label.height, 16)
    }
    const metrics = Object.fromEntries(controls.map(control => [control.id, control]))
    check(`${width}: min and max revenue inputs share a baseline`, metrics['filter-min'].top, metrics['filter-max'].top)
    check(`${width}: min and max revenue inputs are equal width`, Math.abs(metrics['filter-min'].width - metrics['filter-max'].width) <= 1)
    if (width >= 1024) {
      check(`${width}: desktop filter row shares one baseline`, new Set(controls.map(control => control.top)).size, 1)
    }
    controlBaseline[width] = controls.map(control => `${control.id}=${control.width}x${control.height}@top${control.top}`)

    await page.evaluate(() => window.scrollTo(0, 2000))
    await page.waitForFunction(() => window.scrollY > 0)
    check(`${width}: sticky header stays pinned while scrolling`, Math.abs((await header.boundingBox()).y) <= 1)
    await page.evaluate(() => window.scrollTo(0, 0))

    await page.evaluate(() => { window.location.hash = '/about' })
    await page.getByRole('heading', { name: 'About CharityCheck', exact: true }).waitFor()
    check(`${width}: about has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

    await page.evaluate(ein => { window.location.hash = `/org/${ein}` }, records[0].ein)
    await page.getByRole('heading', { name: records[0].name, exact: true }).waitFor()
    check(`${width}: detail has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await context.close()
  }

  check('local browsing, malformed routes and invalid EINs send no third-party requests', externalRequests, [])
  check('no browser page errors', errors, [])
  const result = { mode: 'Built production files in Chromium through static route interception; no production server or mocked API responses', records: records.length, viewports: layoutViewports, deepRecordViewports: [390, 1440], checks: checks.length, failed: 0, controlBaseline, externalRequests, errors, assertions: checks }
  await mkdir(output, { recursive: true })
  await writeFile(`${output}/browser-verification.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ records: result.records, viewports: result.viewports, deepRecordViewports: result.deepRecordViewports, checks: result.checks, failed: result.failed, controlBaseline: result.controlBaseline, externalRequests: result.externalRequests, errors: result.errors }))
} finally {
  await browser.close()
}
