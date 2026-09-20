import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { charities, getCauseSummaries, latestTaxYear } from '../data/charities'

export function Home() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const causes = getCauseSummaries()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse')
  }

  if (charities.length === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">No data yet</h1>
        <p className="mt-2 text-slate-500">
          The curated dataset is empty. Run <code>npm run data:fetch</code> to build it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 px-6 py-12 text-center text-white sm:px-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Check before you give.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-emerald-100">
          CharityCheck summarizes IRS Form 990 filings so you can see whether a charity is
          registered, tax-exempt, and financially transparent — before you donate.
        </p>
        <form
          onSubmit={handleSubmit}
          role="search"
          aria-label="Search the curated dataset"
          className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row"
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, EIN, or city"
            aria-label="Search charities by name, EIN, or city"
            className="w-full rounded-xl border-0 bg-white px-5 py-3.5 text-base text-slate-900 shadow-sm outline-none ring-1 ring-white/20 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-300"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-emerald-400"
          >
            Search
          </button>
        </form>
      </section>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Dataset at a glance
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <dt className="text-sm font-medium text-slate-500">Charities tracked</dt>
            <dd className="mt-1 text-3xl font-bold text-slate-900">{charities.length}</dd>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <dt className="text-sm font-medium text-slate-500">Latest tax year</dt>
            <dd className="mt-1 text-3xl font-bold text-slate-900">{latestTaxYear || '—'}</dd>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <dt className="text-sm font-medium text-slate-500">Source</dt>
            <dd className="mt-1 text-sm font-semibold leading-snug text-slate-900">
              IRS Form 990 filings via ProPublica Nonprofit Explorer
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="causes-heading">
        <h2 id="causes-heading" className="text-2xl font-bold text-slate-900">
          Browse by cause
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Categories are derived from each charity&apos;s IRS NTEE activity code.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {causes.map((cause) => (
            <li key={cause.letter}>
              <Link
                to={`/browse?cause=${cause.letter}`}
                className="block h-full rounded-xl bg-white p-4 ring-1 ring-slate-200 transition hover:shadow-sm hover:ring-emerald-400"
              >
                <span className="block font-semibold text-slate-900">{cause.label}</span>
                <span className="mt-1 block text-sm text-slate-500">
                  {cause.count} {cause.count === 1 ? 'charity' : 'charities'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
