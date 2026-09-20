import { Link, useSearchParams } from 'react-router-dom'
import { CharityCard } from '../components/CharityCard'
import { allStates, charities, getCauseSummaries } from '../data/charities'
import { filterCharities, type CharityFilters } from '../lib/query'

const SELECT_CLASS =
  'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-emerald-500'
const LABEL_CLASS = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'

function numberParam(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export function Browse() {
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const state = searchParams.get('state') ?? ''
  const cause = searchParams.get('cause') ?? ''
  const minRevenue = searchParams.get('minRevenue') ?? ''
  const maxRevenue = searchParams.get('maxRevenue') ?? ''

  const filters: CharityFilters = {
    q,
    state,
    cause,
    minRevenue: numberParam(minRevenue),
    maxRevenue: numberParam(maxRevenue),
  }

  const results = filterCharities(charities, filters)
  const hasFilters = Boolean(q || state || cause || minRevenue || maxRevenue)

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Browse charities</h1>
        <p className="mt-1 text-sm text-slate-500">
          Filter the curated dataset by location, cause, revenue, or keyword.
        </p>
      </div>

      <section aria-label="Filters" className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <label htmlFor="filter-q" className={LABEL_CLASS}>
              Search
            </label>
            <input
              id="filter-q"
              type="search"
              value={q}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="Name, EIN, or city"
              className={`${SELECT_CLASS} mt-1`}
            />
          </div>
          <div>
            <label htmlFor="filter-state" className={LABEL_CLASS}>
              State
            </label>
            <select
              id="filter-state"
              value={state}
              onChange={(event) => updateParam('state', event.target.value)}
              className={`${SELECT_CLASS} mt-1`}
            >
              <option value="">All states</option>
              {allStates.map((stateCode) => (
                <option key={stateCode} value={stateCode}>
                  {stateCode}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-cause" className={LABEL_CLASS}>
              Cause
            </label>
            <select
              id="filter-cause"
              value={cause}
              onChange={(event) => updateParam('cause', event.target.value)}
              className={`${SELECT_CLASS} mt-1`}
            >
              <option value="">All causes</option>
              {getCauseSummaries().map((summary) => (
                <option key={summary.letter} value={summary.letter}>
                  {summary.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filter-min" className={LABEL_CLASS}>
                Min revenue
              </label>
              <input
                id="filter-min"
                type="number"
                min="0"
                value={minRevenue}
                onChange={(event) => updateParam('minRevenue', event.target.value)}
                placeholder="0"
                className={`${SELECT_CLASS} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="filter-max" className={LABEL_CLASS}>
                Max revenue
              </label>
              <input
                id="filter-max"
                type="number"
                min="0"
                value={maxRevenue}
                onChange={(event) => updateParam('maxRevenue', event.target.value)}
                placeholder="Any"
                className={`${SELECT_CLASS} mt-1`}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600" role="status">
          Showing <span className="font-semibold">{results.length}</span> of {charities.length}{' '}
          charities
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">No charities match your filters.</p>
          <p className="mt-1 text-sm text-slate-500">Try widening the revenue range or clearing the search.</p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((org) => (
            <CharityCard key={org.ein} org={org} />
          ))}
        </ul>
      )}

      <p className="text-sm text-slate-500">
        Looking for a specific nonprofit? Learn how the data is collected on the{' '}
        <Link to="/about" className="font-medium text-emerald-700 hover:underline">
          About page
        </Link>
        .
      </p>
    </div>
  )
}
