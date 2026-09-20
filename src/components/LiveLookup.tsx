import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { charities } from '../data/charities'
import { causeFromNtee, formatEin, formatMoney } from '../lib/status'

const PROXY_RAW_URL = 'https://api.allorigins.win/raw?url='
const PROXY_GET_URL = 'https://api.allorigins.win/get?url='
const API_BASE = 'https://projects.propublica.org/nonprofits/api/v2'
const TIMEOUT_MS = 8000

const EIN_PATTERN = /^\d{2}-?\d{7}$/

interface LiveOrg {
  ein: number | string
  name?: string
  city?: string | null
  state?: string | null
  ntee_code?: string | null
  subseccd?: number | null
  subsection_code?: number | null
  totrevenue?: number | null
  totassetsend?: number | null
  pdf_url?: string | null
}

interface LiveResult {
  ein: number
  name: string
  location: string
  cause: string
  is501c3: boolean
  revenue: number | null
  assets: number | null
  pdfUrl: string | null
}

type LookupStatus = 'idle' | 'loading' | 'error' | 'done'

function toResult(raw: LiveOrg): LiveResult {
  const ein = Number(raw.ein)
  return {
    ein,
    name: raw.name ?? `EIN ${formatEin(ein)}`,
    location: [raw.city, raw.state].filter(Boolean).join(', '),
    cause: causeFromNtee(raw.ntee_code ?? null),
    is501c3: (raw.subsection_code ?? raw.subseccd) === 3,
    revenue: typeof raw.totrevenue === 'number' ? raw.totrevenue : null,
    assets: typeof raw.totassetsend === 'number' ? raw.totassetsend : null,
    pdfUrl: raw.pdf_url ?? null,
  }
}

function targetUrlFor(query: string): string {
  if (EIN_PATTERN.test(query.trim())) {
    return `${API_BASE}/organizations/${query.replace(/\D+/g, '')}.json`
  }
  return `${API_BASE}/search.json?q=${encodeURIComponent(query.trim())}`
}

// Primary path is allorigins /raw (per spec); it has been flaky (Cloudflare
// 522), so we fall back to the same service's /get route, which returns the
// response wrapped in { contents: "<json string>" }.
async function fetchViaProxy(targetUrl: string): Promise<unknown> {
  try {
    const response = await fetch(`${PROXY_RAW_URL}${encodeURIComponent(targetUrl)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch {
    const response = await fetch(`${PROXY_GET_URL}${encodeURIComponent(targetUrl)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = (await response.json()) as { contents?: unknown }
    if (typeof payload.contents !== 'string') throw new Error('Unexpected proxy response')
    return JSON.parse(payload.contents)
  }
}

async function fetchLiveResults(query: string): Promise<LiveResult[]> {
  const data = await fetchViaProxy(targetUrlFor(query))

  if (data && typeof data === 'object' && 'organization' in data) {
    const org = (data as { organization: LiveOrg | null }).organization
    return org ? [toResult(org)] : []
  }
  if (data && typeof data === 'object' && 'organizations' in data) {
    const orgs = (data as { organizations: LiveOrg[] | null }).organizations ?? []
    return orgs.slice(0, 5).map(toResult)
  }
  return []
}

export function LiveLookup({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<LookupStatus>('idle')
  const [results, setResults] = useState<LiveResult[]>([])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = query.trim()
    if (!term) return
    setStatus('loading')
    setResults([])
    try {
      const liveResults = await fetchLiveResults(term)
      setResults(liveResults)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section aria-labelledby="live-lookup-heading" className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h2 id="live-lookup-heading" className="text-lg font-semibold text-slate-900">
        Look up any EIN or name
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Check any U.S. nonprofit against live IRS data via ProPublica — not just the {charities.length}{' '}
        curated ones.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. 53-0196605 or Wildlife Fund"
          aria-label="EIN or organization name"
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {status === 'loading' && (
        <p role="status" className="mt-3 text-sm text-slate-500">
          Contacting ProPublica…
        </p>
      )}

      {status === 'error' && (
        <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-medium">
            Live lookup is temporarily unavailable — browse the curated dataset below.
          </p>
          <Link to="/browse" className="mt-2 inline-block font-semibold text-amber-900 underline hover:no-underline">
            Browse the curated dataset
          </Link>
        </div>
      )}

      {status === 'done' && results.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No matching organization found in IRS data.</p>
      )}

      {status === 'done' && results.length > 0 && (
        <div className="mt-4">
          <p className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
            Live IRS data via ProPublica
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-slate-100">
            {results.map((result) => {
              const curated = charities.some((charity) => charity.ein === result.ein)
              return (
                <li key={result.ein} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="font-semibold text-slate-900">{result.name}</h3>
                    <span className="font-mono text-xs text-slate-500">
                      EIN {formatEin(result.ein)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {[
                      result.location || 'Location not listed',
                      result.cause,
                      result.is501c3 ? '501(c)(3)' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {(result.revenue !== null || result.assets !== null) && (
                    <p className="mt-0.5 text-sm text-slate-600">
                      Revenue {formatMoney(result.revenue)} · Assets {formatMoney(result.assets)}
                    </p>
                  )}
                  <p className="mt-1 text-sm">
                    {curated ? (
                      <Link to={`/org/${result.ein}`} className="font-medium text-emerald-700 hover:underline">
                        View full profile →
                      </Link>
                    ) : (
                      <a
                        href={`https://projects.propublica.org/nonprofits/organizations/${result.ein}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        View on ProPublica →
                      </a>
                    )}
                    {result.pdfUrl && (
                      <>
                        {' · '}
                        <a
                          href={result.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          Form 990 PDF
                        </a>
                      </>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
