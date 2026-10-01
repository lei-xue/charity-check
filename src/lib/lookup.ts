import { classifyEinQuery, toLiveResult, type LiveResult } from './status.ts'

const API_BASE = 'https://projects.propublica.org/nonprofits/api/v2'
export const LOOKUP_API = 'https://charitycheck-lookup.leixuework.workers.dev/lookup'
export const LOOKUP_DEADLINE_MS = 12000

export interface LookupPage {
  results: LiveResult[]
  page: number
  pages: number
  total: number
  perPage: number
  sourceLimit: boolean
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function lookupUrl(query: string, page = 0): string {
  const input = classifyEinQuery(query)
  if (!Number.isSafeInteger(page) || page < 0 || page > 399) throw new Error('Invalid source page')
  if (!input.value || input.value.length > 200 || input.kind === 'invalid-ein') {
    throw new Error('Enter an organization name or a valid nine-digit EIN')
  }
  if (input.kind === 'ein') {
    if (page !== 0) throw new Error('EIN lookup has one result page')
    return `${API_BASE}/organizations/${input.ein}.json`
  }
  return `${API_BASE}/search.json?q=${encodeURIComponent(input.value)}&page=${page}`
}

export function parseLookupPage(value: unknown, query: string, page: number): LookupPage {
  if (!record(value)) throw new Error('Unexpected source response')
  const input = classifyEinQuery(query)
  if (input.kind === 'ein') {
    if (!('organization' in value)) throw new Error('Missing organization response')
    if (value.organization === null) return {results:[], page:0, pages:1, total:0, perPage:1, sourceLimit:false}
    if (!record(value.organization)) throw new Error('Invalid organization')
    let raw = value.organization
    if (Array.isArray(value.filings_with_data)) {
      const filings = value.filings_with_data.filter(record)
        .filter(f => typeof f.tax_prd === 'number' && /^\d{4}(0[1-9]|1[0-2])$/.test(String(f.tax_prd)))
        .sort((a,b) => Number(b.tax_prd)-Number(a.tax_prd))
      if (filings[0]) raw = {...raw, ...filings[0], ein:raw.ein, name:raw.name, city:raw.city, state:raw.state, ntee_code:raw.ntee_code, subsection_code:raw.subsection_code}
    }
    const result = toLiveResult(raw)
    if (!result || String(result.ein).padStart(9,'0') !== input.ein) throw new Error('Source identifier does not match the requested EIN')
    return {results:[result], page:0, pages:1, total:1, perPage:1, sourceLimit:false}
  }
  if (input.kind !== 'text' || !Array.isArray(value.organizations)) throw new Error('Invalid search response')
  const {total_results:total, num_pages:pages, cur_page:current, per_page:perPage} = value
  if (!count(total) || !count(pages) || !count(current) || !count(perPage)
    || perPage < 1 || perPage > 100 || pages > 400 || total > 10000 || current !== page
    || (total > 0 && (pages < 1 || current >= pages))
    || value.organizations.length > perPage || value.organizations.length > total
    || (total > 0 && pages !== Math.ceil(total/perPage))) {
    throw new Error('Invalid source pagination')
  }
  const results = value.organizations.map(toLiveResult)
  if (results.some(result => result === null)) throw new Error('Malformed organization in source response')
  const usable = results as LiveResult[]
  if (new Set(usable.map(r=>r.ein)).size !== usable.length) throw new Error('Duplicate source identifiers')
  if (total > 0 && usable.length === 0) throw new Error('Incomplete source page')
  return {results:usable, page:current, pages:Math.max(1,pages), total, perPage, sourceLimit:total===10000}
}

/** Fixed first-party endpoint with one overall deadline and no third-party fallback. */
export async function lookup(query: string, page: number, signal: AbortSignal, fetcher: typeof fetch = fetch, deadline = LOOKUP_DEADLINE_MS): Promise<LookupPage> {
  lookupUrl(query,page)
  const overall = AbortSignal.any([signal, AbortSignal.timeout(deadline)])
  overall.throwIfAborted()
  const response = await fetcher(`${LOOKUP_API}?q=${encodeURIComponent(query.trim())}&page=${page}`, {signal:overall, headers:{accept:'application/json'}})
  if (!response.ok) throw new Error(`Source HTTP ${response.status}`)
  const payload: unknown = await response.json()
  overall.throwIfAborted()
  return parseLookupPage(payload,query,page)
}
