import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CharityCard } from '../components/CharityCard'
import { LiveLookup } from '../components/LiveLookup'
import { allStates, charities, getCauseSummaries } from '../data/charities'
import { BROWSE_PAGE_SIZE, clampPage, pageCount, pageItems, pageRange } from '../lib/pagination'
import { filterCharities, type CharityFilters } from '../lib/query'

const CONTROL_CLASS =
  'mt-1 h-11 w-full min-w-0 rounded-lg border-0 bg-white px-3 text-base text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500'
// Fixed min height keeps every field label on one line so the controls
// below them share the same vertical offset even at desktop grid widths.
const LABEL_CLASS = 'block min-h-5 text-sm font-semibold text-slate-600'
const PAGE_BUTTON_CLASS =
  'flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium ring-1 transition disabled:opacity-50 '

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

  const totalPages = pageCount(results.length)
  const requestedPage = numberParam(searchParams.get('page')) ?? 1
  const page = clampPage(requestedPage, results.length)
  const visibleOrgs = pageItems(results, page)
  const range = pageRange(results.length, page)

  const summaryRef = useRef<HTMLParagraphElement>(null)
  // Set only by an explicit pagination click, so filter typing, initial load,
  // and implicit clamping never steal scroll or focus.
  const pageActionRef = useRef(false)

  useEffect(() => {
    if (!pageActionRef.current) return
    pageActionRef.current = false
    const summary = summaryRef.current
    if (!summary) return
    summary.focus({ preventScroll: true })
    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0
    window.scrollTo({
      top: window.scrollY + summary.getBoundingClientRect().top - headerHeight - 16,
      behavior: 'auto',
    })
  }, [page])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    // Any filter change returns the reader to the first page of the new result set.
    next.delete('page')
    // A filter edit is not a pagination action: drop any stale pending intent
    // so the passive page reset never steals scroll or focus.
    pageActionRef.current = false
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    pageActionRef.current = false
    setSearchParams(new URLSearchParams(), { replace: true })
    // The clicked clear button unmounts once filters are gone, so restore
    // focus to the search input instead of dropping it to <body>.
    document.getElementById('filter-q')?.focus()
  }

  function goToPage(target: number) {
    pageActionRef.current = true
    const next = new URLSearchParams(searchParams)
    const bounded = clampPage(target, results.length)
    if (bounded <= 1) {
      next.delete('page')
    } else {
      next.set('page', String(bounded))
    }
    setSearchParams(next, { replace: true })
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="flex min-w-0 flex-col sm:col-span-2">
            <label htmlFor="filter-q" className={LABEL_CLASS}>
              Search
            </label>
            <input
              id="filter-q"
              type="search"
              value={q}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="Name, EIN, or city"
              className={CONTROL_CLASS}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <label htmlFor="filter-state" className={LABEL_CLASS}>
              State
            </label>
            <select
              id="filter-state"
              value={state}
              onChange={(event) => updateParam('state', event.target.value)}
              className={CONTROL_CLASS}
            >
              <option value="">All states</option>
              {allStates.map((stateCode) => (
                <option key={stateCode} value={stateCode}>
                  {stateCode}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col">
            <label htmlFor="filter-cause" className={LABEL_CLASS}>
              Cause
            </label>
            <select
              id="filter-cause"
              value={cause}
              onChange={(event) => updateParam('cause', event.target.value)}
              className={CONTROL_CLASS}
            >
              <option value="">All causes</option>
              {getCauseSummaries().map((summary) => (
                <option key={summary.letter} value={summary.letter}>
                  {summary.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-w-0 flex-col">
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
                  className={CONTROL_CLASS}
                />
              </div>
              <div className="flex min-w-0 flex-col">
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
                  className={CONTROL_CLASS}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {q.trim() && <LiveLookup key={q} searchQuery={q} />}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600" role="status" ref={summaryRef} tabIndex={-1}>
          {range ? (
            <>
              Showing <span className="font-semibold">{range[0]}–{range[1]}</span> of{' '}
              <span className="font-semibold">{results.length}</span> matching charities (
              {charities.length} total)
            </>
          ) : (
            <>
              No charities match — <span className="font-semibold">0</span> of {charities.length}{' '}
              charities shown
            </>
          )}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-11 items-center rounded-lg px-3 text-sm font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50"
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
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleOrgs.map((org) => (
              <CharityCard key={org.ein} org={org} />
            ))}
          </ul>
          {totalPages > 1 && (
            <nav aria-label="Browse result pages" className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className={`${PAGE_BUTTON_CLASS} text-brand-700 ring-brand-200 hover:bg-brand-50`}
              >
                Previous
              </button>
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{page}</span> of{' '}
                <span className="font-semibold">{totalPages}</span> · {BROWSE_PAGE_SIZE} per page
              </p>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className={`${PAGE_BUTTON_CLASS} text-brand-700 ring-brand-200 hover:bg-brand-50`}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      <p className="text-sm text-slate-500">
        Looking for a specific nonprofit? Learn how the data is collected on the{' '}
        <Link to="/about" className="font-medium text-brand-700 hover:underline">
          About page
        </Link>
        .
      </p>
    </div>
  )
}
