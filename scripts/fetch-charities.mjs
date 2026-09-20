#!/usr/bin/env node
// Build the baked dataset for CharityCheck from the ProPublica Nonprofit
// Explorer API v2 (free, no key, no CORS - server-side fetch only).
//
// - One search request (+ org detail, + tie-break details) per curated name
// - 300ms delay between every request (politeness)
// - Resumable: successful results and "no result" misses are cached in
//   scripts/.fetch-state.json, so re-runs only fetch what is missing
//   (pass --refresh to ignore the cache)
// - Individual failures are logged and skipped; the script never throws
//
// Matching notes (documented decisions, see README/report):
// - Some curated names are acronyms or DBAs whose IRS legal name differs,
//   so those entries carry an explicit `query` (official name) instead.
// - charity: water and YMCA of the USA cannot be found by name search at
//   all (charity: water's legal name is "Charity Global Inc"; Y-USA's is
//   "National Council Of Young Mens Christian Assns Of The Usa"), so they
//   carry a verified EIN to fetch directly.
// - When several orgs share the exact same normalized name (e.g. "American
//   Cancer Society" national + divisions), we fetch each candidate's org
//   record and keep the one with the highest IRS-reported income.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE_FILE = path.join(ROOT, 'scripts', '.fetch-state.json')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'charities.json')
const META_FILE = path.join(ROOT, 'src', 'data', 'dataset-meta.json')
const API = 'https://projects.propublica.org/nonprofits/api/v2'
const DELAY_MS = 300
const REQUEST_TIMEOUT_MS = 20_000

const ENTRIES = [
  { label: 'American Red Cross', query: 'American National Red Cross' },
  { label: 'United Way Worldwide' },
  { label: "St. Jude Children's Research Hospital" },
  { label: 'Feeding America' },
  {
    label: 'Salvation Army',
    ein: 222406433,
    note: 'Salvation Army National Corp; territories file group returns, so ProPublica has no extracted financials for SA national EINs',
  },
  { label: 'Habitat for Humanity International', ein: 911914868 },
  { label: 'Goodwill Industries International' },
  { label: 'Planned Parenthood Federation of America' },
  { label: 'ACLU Foundation', query: 'American Civil Liberties Union Foundation' },
  { label: 'Electronic Frontier Foundation' },
  { label: 'Wikimedia Foundation' },
  { label: 'Khan Academy' },
  { label: 'charity: water', ein: 223936753, note: 'legal name Charity Global Inc' },
  { label: 'Doctors Without Borders USA', note: 'IRS name Medecins Sans Frontieres Usa Inc' },
  { label: 'Direct Relief' },
  {
    label: 'ASPCA',
    query: 'American Society for the Prevention of Cruelty to Animals',
  },
  { label: 'World Wildlife Fund' },
  { label: 'The Nature Conservancy', query: 'Nature Conservancy' },
  { label: 'Make-A-Wish Foundation', query: 'Make-A-Wish Foundation of America' },
  { label: 'Boys & Girls Clubs of America' },
  {
    label: 'YMCA of the USA',
    ein: 363258696,
    note: 'legal name National Council Of Young Mens Christian Assns Of The Usa',
  },
  { label: 'American Cancer Society', note: 'multiple same-name orgs; largest wins' },
  {
    label: "Alzheimer's Association",
    query: 'Alzheimers Disease and Related Disorders Association',
  },
  { label: 'Susan G. Komen' },
  { label: 'March of Dimes' },
  { label: 'Special Olympics' },
  { label: 'Best Friends Animal Society' },
  {
    label: 'Humane Society of the United States',
    query: 'Humane World for Animals',
    note: 'HSUS rebranded to Humane World For Animals in 2025, same EIN 53-0225390',
  },
  { label: 'Ocean Conservancy' },
  { label: 'Sierra Club Foundation' },
  { label: 'NPR', query: 'National Public Radio' },
  { label: 'ProPublica' },
  { label: 'Mozilla Foundation' },
  { label: 'American Heart Association' },
  { label: 'Compassion International' },
  { label: 'World Vision' },
  { label: "Samaritan's Purse" },
  { label: 'Catholic Charities USA' },
  { label: 'Lutheran Services in America' },
  { label: 'Task Force for Global Health' },
]

const SUFFIX_WORDS = new Set([
  'inc',
  'incorporated',
  'org',
  'organization',
  'corp',
  'corporation',
])

function normalizeName(value) {
  const cleaned = String(value ?? '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  const withoutArticle = cleaned.startsWith('the ') ? cleaned.slice(4) : cleaned
  const words = withoutArticle.split(' ')
  while (words.length > 1 && SUFFIX_WORDS.has(words[words.length - 1])) words.pop()
  return words.join(' ')
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function fetchOrganization(ein) {
  await sleep(DELAY_MS)
  return getJson(`${API}/organizations/${ein}.json`)
}

async function searchOrganizations(query) {
  await sleep(DELAY_MS)
  const search = await getJson(
    `${API}/search.json?q=${encodeURIComponent(query)}`,
  )
  return [...(search.organizations ?? [])].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  )
}

// Tier the raw result list: exact normalized-name matches first, then
// substring matches, then space-insensitive matches, then raw top score.
function tierResults(results, query) {
  const q = normalizeName(query)
  const qCompact = q.replace(/\s+/g, '')

  const exact = results.filter((org) => normalizeName(org.name) === q)
  if (exact.length > 0) return { tier: 'exact', orgs: exact }

  const contains = results.filter((org) => normalizeName(org.name).includes(q))
  if (contains.length > 0) return { tier: 'contains', orgs: [contains[0]] }

  const compact = results.filter((org) => {
    const n = normalizeName(org.name).replace(/\s+/g, '')
    return n.includes(qCompact) || (qCompact.includes(n) && n.length >= 8)
  })
  if (compact.length > 0) return { tier: 'compact', orgs: [compact[0]] }

  if (results.length > 0) return { tier: 'best-score', orgs: [results[0]] }
  return { tier: 'none', orgs: [] }
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeOrg(organization, filingsWithData) {
  const filings = Array.isArray(filingsWithData) ? [...filingsWithData] : []
  filings.sort((a, b) => (b.tax_prd ?? 0) - (a.tax_prd ?? 0))
  const filing = filings[0] ?? null

  return {
    ein: Number(organization.ein),
    name: organization.name ?? '',
    city: organization.city ?? null,
    state: organization.state ?? null,
    nteeCode: organization.ntee_code ?? null,
    subsectionCode: Number(organization.subsection_code ?? 0),
    rulingDate: organization.ruling_date ?? null,
    assetAmount: numberOrNull(organization.asset_amount),
    incomeAmount: numberOrNull(organization.income_amount),
    revenueAmount: numberOrNull(organization.revenue_amount),
    latestFiling: filing
      ? {
          taxPeriod: numberOrNull(filing.tax_prd),
          totalRevenue: numberOrNull(filing.totrevenue),
          totalExpenses: numberOrNull(filing.totfuncexpns),
          totalAssets: numberOrNull(filing.totassetsend),
          pdfUrl: filing.pdf_url ?? null,
        }
      : null,
  }
}

// Resolve one curated entry to a normalized charity record (or null).
async function resolveEntry(entry, label) {
  if (entry.ein) {
    const detail = await fetchOrganization(entry.ein)
    if (!detail.organization) throw new Error(`EIN ${entry.ein} not found`)
    return { charity: normalizeOrg(detail.organization, detail.filings_with_data), tier: 'ein' }
  }

  const results = await searchOrganizations(entry.query ?? label)
  const { tier, orgs } = tierResults(results, entry.query ?? label)
  if (orgs.length === 0) return null

  if (orgs.length === 1) {
    const detail = await fetchOrganization(orgs[0].ein)
    if (!detail.organization) throw new Error(`EIN ${orgs[0].ein} not found`)
    return {
      charity: normalizeOrg(detail.organization, detail.filings_with_data),
      tier,
    }
  }

  // Same normalized name for several orgs: keep the largest by IRS-reported
  // income (national office beats divisions/chapters that share the name).
  const candidates = []
  for (const org of orgs) {
    const detail = await fetchOrganization(org.ein)
    if (detail.organization) candidates.push(detail)
  }
  candidates.sort(
    (a, b) => orgMagnitude(b) - orgMagnitude(a),
  )
  const winner = candidates[0]
  console.log(
    `      tie-break: ${candidates
      .map(
        (c) =>
          `${c.organization.ein}=$${(orgMagnitude(c) / 1e6).toFixed(0)}M`,
      )
      .join(', ')}`,
  )
  return { charity: normalizeOrg(winner.organization, winner.filings_with_data), tier }
}

// Financial magnitude of an org record: prefer the IRS BMF income amount,
// then the BMF revenue amount, then the newest filing's total revenue.
// (Some BMF records report 0/null income, so filing data is the fallback.)
function orgMagnitude(detail) {
  const org = detail.organization ?? {}
  const filings = [...(detail.filings_with_data ?? [])].sort(
    (a, b) => (b.tax_prd ?? 0) - (a.tax_prd ?? 0),
  )
  for (const value of [org.income_amount, org.revenue_amount, filings[0]?.totrevenue]) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  }
  return 0
}

async function main() {
  const refresh = process.argv.includes('--refresh')
  await mkdir(path.dirname(OUT_FILE), { recursive: true })

  let state = {}
  try {
    state = JSON.parse(await readFile(STATE_FILE, 'utf8'))
  } catch {
    state = {}
  }
  if (refresh) state = {}

  const charities = []
  let fetched = 0
  let cached = 0
  let noResults = 0
  let failed = 0

  for (const entry of ENTRIES) {
    const label = entry.label
    const cachedEntry = state[label]
    if (cachedEntry?.charity) {
      charities.push(cachedEntry.charity)
      cached++
      console.log(`cache ${label} -> ${cachedEntry.charity.name} (${cachedEntry.charity.ein})`)
      continue
    }
    if (cachedEntry?.miss) {
      noResults++
      console.warn(`miss  ${label} -> ${cachedEntry.note}`)
      continue
    }

    try {
      const resolved = await resolveEntry(entry, label)
      if (!resolved) {
        state[label] = { miss: true, note: 'no search results' }
        noResults++
        console.warn(`miss  ${label} -> no search results`)
        continue
      }
      state[label] = {
        tier: resolved.tier,
        ein: resolved.charity.ein,
        note: entry.note,
        charity: resolved.charity,
      }
      charities.push(resolved.charity)
      fetched++
      console.log(
        `ok    [${resolved.tier}] ${label} -> ${resolved.charity.name} (${resolved.charity.ein}, ${resolved.charity.city}, ${resolved.charity.state})`,
      )
    } catch (error) {
      failed++
      console.warn(`ERR   ${label} -> ${error?.message ?? error}`)
    }
  }

  charities.sort((a, b) => a.name.localeCompare(b.name))

  const meta = {
    generatedAt: new Date().toISOString(),
    source: 'IRS Form 990 data via the ProPublica Nonprofit Explorer API v2',
    count: charities.length,
  }

  await writeFile(OUT_FILE, `${JSON.stringify(charities, null, 2)}\n`)
  await writeFile(META_FILE, `${JSON.stringify(meta, null, 2)}\n`)
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)

  console.log(
    `Done: ${fetched} fetched, ${cached} cached, ${noResults} no-results, ` +
      `${failed} failed. charities.json has ${charities.length} entries.`,
  )
}

main().catch((error) => {
  console.error('FATAL', error)
  // Never fail the whole build over dataset fetch problems.
  process.exit(0)
})
