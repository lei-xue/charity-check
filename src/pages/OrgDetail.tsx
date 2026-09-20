import { Link, useParams } from 'react-router-dom'
import { BadgeList } from '../components/Badge'
import { LiveLookup } from '../components/LiveLookup'
import { findByEin } from '../data/charities'
import {
  causeFromNtee,
  formatEin,
  formatMoney,
  formatTaxPeriod,
  getBadges,
  rulingYear,
} from '../lib/status'

function FinancialCard({
  label,
  amount,
  period,
}: {
  label: string
  amount: number | null
  period?: string
}) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(amount)}</dd>
      {period && <p className="mt-1 text-xs text-slate-400">{period}</p>}
    </div>
  )
}

export function OrgDetail() {
  const { ein } = useParams()
  const digits = (ein ?? '').replace(/\D+/g, '')
  const org = digits ? findByEin(Number(digits)) : undefined

  if (!org) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Not in the curated dataset</h1>
          <p className="mt-2 text-slate-500">
            This organization (EIN {ein}) is not part of our baked dataset of major U.S.
            charities. Use the live lookup below to check it against IRS data, or browse the
            curated list.
          </p>
          <Link
            to="/browse"
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700"
          >
            Browse charities
          </Link>
        </div>
        <LiveLookup initialQuery={ein && digits ? formatEin(Number(digits)) : ''} />
      </div>
    )
  }

  const filing = org.latestFiling
  const location = [org.city, org.state].filter(Boolean).join(', ')
  const year = rulingYear(org.rulingDate)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link to="/browse" className="font-medium text-emerald-700 hover:underline">
          ← Back to browse
        </Link>
      </p>

      <header className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p className="font-mono text-sm text-slate-500">EIN {formatEin(org.ein)}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{org.name}</h1>
        <div className="mt-3">
          <BadgeList badges={getBadges(org)} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-slate-500">Location</dt>
            <dd className="mt-0.5 text-slate-900">{location || 'Not listed'}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Cause</dt>
            <dd className="mt-0.5 text-slate-900">
              {causeFromNtee(org.nteeCode)}
              {org.nteeCode && (
                <span className="ml-1 font-mono text-xs text-slate-400">({org.nteeCode})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">IRS ruling year</dt>
            <dd className="mt-0.5 text-slate-900">{year ?? 'Unknown'}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="financials-heading">
        <h2 id="financials-heading" className="text-xl font-bold text-slate-900">
          Financial snapshot
        </h2>
        {filing ? (
          <>
            <p className="mt-1 text-sm text-slate-500">
              From the most recent Form 990 filing with extracted data (tax period{' '}
              {formatTaxPeriod(filing.taxPeriod)}).
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FinancialCard label="Total revenue" amount={filing.totalRevenue} />
              <FinancialCard label="Total expenses" amount={filing.totalExpenses} />
              <FinancialCard label="Total assets (year end)" amount={filing.totalAssets} />
            </dl>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 p-5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
            No recent Form 990 data on file.
          </p>
        )}
      </section>

      <section aria-labelledby="sources-heading" className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 id="sources-heading" className="text-lg font-semibold text-slate-900">
          Official sources
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:gap-4">
          {filing?.pdfUrl && (
            <li>
              <a
                href={filing.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700"
              >
                Official Form 990 PDF
              </a>
            </li>
          )}
          <li>
            <a
              href={`https://projects.propublica.org/nonprofits/organizations/${org.ein}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-lg px-4 py-2 font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
            >
              View on ProPublica Nonprofit Explorer
            </a>
          </li>
        </ul>
      </section>

      <LiveLookup />
    </div>
  )
}
