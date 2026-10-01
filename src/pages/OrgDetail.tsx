import { Link, useParams } from 'react-router-dom'
import { BadgeList } from '../components/Badge'
import { LiveLookup } from '../components/LiveLookup'
import { charities, resolveCuratedRoute, snapshotDateLabel } from '../data/charities'
import {
  causeFromNtee,
  classifyEinQuery,
  formatEin,
  formatMoney,
  formatTaxPeriod,
  getBadges,
  rulingYear,
  safeDocumentUrl,
} from '../lib/status'

function FinancialCard({ label, amount }: { label: string; amount: number | null }) {
  const missing = amount === null || amount === undefined || !Number.isFinite(amount)
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd
        className={
          missing
            ? 'mt-1 text-base font-medium text-slate-500'
            : 'mt-1 text-2xl font-bold text-slate-900'
        }
      >
        {missing ? 'Not reported' : formatMoney(amount)}
      </dd>
    </div>
  )
}

export function OrgDetail() {
  const params = useParams()
  const routeParam = params.ein ?? ''
  const org = resolveCuratedRoute(routeParam)
  const query = classifyEinQuery(routeParam)

  if (!org) {
    if (query.kind === 'ein' && query.ein) {
      const canonical = `${query.ein.slice(0, 2)}-${query.ein.slice(2)}`
      return (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
            <h1 className="text-2xl font-bold text-slate-900">Not in the curated dataset</h1>
            <p className="mt-2 text-slate-500">
              EIN {canonical} is not one of the {charities.length} organizations in our snapshot
              of public records. Use the lookup below to check it against ProPublica, or browse
              the curated list.
            </p>
            <Link
              to="/browse"
              className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700"
            >
              Browse charities
            </Link>
          </div>
          <LiveLookup key={routeParam} initialQuery={canonical} />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Invalid EIN in this link</h1>
          <p className="mt-2 text-slate-500">
            {routeParam ? (
              <>
                &ldquo;{routeParam}&rdquo; is not a valid EIN. An EIN is 9 digits, optionally
                written as XX-XXXXXXX (for example 53-0196605).
              </>
            ) : (
              <>This page needs a 9-digit EIN, optionally written as XX-XXXXXXX.</>
            )}{' '}
            You can search by organization name below, or browse the curated list.
          </p>
          <Link
            to="/browse"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700"
          >
            Browse charities
          </Link>
        </div>
        <LiveLookup key={routeParam} />
      </div>
    )
  }

  const filing = org.latestFiling
  const pdfUrl = safeDocumentUrl(filing?.pdfUrl)
  const location = [org.city, org.state].filter(Boolean).join(', ')
  const year = rulingYear(org.rulingDate)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link to="/browse" className="font-medium text-brand-700 hover:underline">
          ← Back to browse
        </Link>
      </p>

      <header className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p className="font-mono text-sm text-slate-500">EIN {formatEin(org.ein)}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{org.name}</h1>
        <div className="mt-3">
          <BadgeList badges={getBadges(org)} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Snapshot captured {snapshotDateLabel()}: public records and historical self-reported Form 990 filings. This page is
          informational and is not a trust or legitimacy certification.
        </p>
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
                <span className="ml-1 font-mono text-xs text-slate-500">({org.nteeCode})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">IRS ruling year (as reported)</dt>
            <dd className="mt-0.5 text-slate-900">{year ?? 'Unknown'}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="financials-heading">
        <h2 id="financials-heading" className="text-xl font-bold text-slate-900">
          Historical financial snapshot
        </h2>
        {filing ? (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Self-reported figures from the most recent Form 990 filing with extracted data (tax
              period {formatTaxPeriod(filing.taxPeriod)}). This is a historical snapshot of what
              the organization reported, not a current IRS status check or an assessment of
              financial health.
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FinancialCard label="Total revenue" amount={filing.totalRevenue} />
              <FinancialCard label="Total expenses" amount={filing.totalExpenses} />
              <FinancialCard label="Total assets (year end)" amount={filing.totalAssets} />
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              &ldquo;$0&rdquo; means the filing reported zero; &ldquo;Not reported&rdquo; means the
              value was absent from the extracted filing. No amount is estimated or invented.
            </p>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 p-5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
            No extracted Form 990 filing was available for this organization at the snapshot
            date. That means the source had no processed financial filing to show — it is not a
            finding of fraud, opacity, or wrongdoing.
          </p>
        )}
      </section>

      <section aria-labelledby="sources-heading" className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 id="sources-heading" className="text-lg font-semibold text-slate-900">
          Official sources
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:gap-4">
          {pdfUrl && (
            <li>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700"
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
              className="inline-block rounded-lg px-4 py-2 font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50"
            >
              View on ProPublica Nonprofit Explorer
            </a>
          </li>
          <li>
            <a
              href="https://apps.irs.gov/app/eos/"
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-lg px-4 py-2 font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50"
            >
              IRS Tax Exempt Organization Search
            </a>
          </li>
        </ul>
      </section>

      <LiveLookup key={routeParam} />
    </div>
  )
}
