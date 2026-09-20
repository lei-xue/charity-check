import { Link } from 'react-router-dom'
import { charities, datasetMeta } from '../data/charities'

function generatedDate(): string {
  const date = new Date(datasetMeta.generatedAt)
  if (Number.isNaN(date.getTime())) return 'unknown date'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function About() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">About CharityCheck</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          CharityCheck is a free, ad-free tool that helps U.S. donors do a quick legitimacy and
          financial-transparency check on a charity before donating. It is built entirely on
          public IRS data.
        </p>
      </div>

      <section aria-labelledby="provenance-heading" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 id="provenance-heading" className="text-xl font-bold text-slate-900">
          Where the data comes from
        </h2>
        <p className="mt-2 text-slate-600">
          All organization records and financial figures come from IRS Form 990 filings,
          accessed through the{' '}
          <a
            href="https://projects.propublica.org/nonprofits/api"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-emerald-700 hover:underline"
          >
            ProPublica Nonprofit Explorer API v2
          </a>
          . ProPublica processes the IRS e-file data and publishes it for free. Nothing on this
          site is estimated, invented, or manually edited — every dollar figure is taken
          directly from the API.
        </p>
        <p className="mt-2 text-slate-600">
          The curated dataset of {charities.length} well-known charities is generated at build
          time (snapshot taken {generatedDate()}), so figures reflect the most recent filing
          available at that moment, not real-time data. The &ldquo;live lookup&rdquo; box on
          charity pages queries the same API in real time through a public CORS proxy; those
          results are labeled &ldquo;Live IRS data via ProPublica.&rdquo;
        </p>
      </section>

      <section aria-labelledby="badges-heading" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 id="badges-heading" className="text-xl font-bold text-slate-900">
          What the badges mean — and their limits
        </h2>
        <dl className="mt-3 flex flex-col gap-3 text-slate-600">
          <div>
            <dt className="font-semibold text-slate-900">Verified</dt>
            <dd>
              The organization exists in current IRS exempt-organization data. Every charity
              listed here carries this badge; it means the record was successfully retrieved
              from the IRS data via ProPublica — nothing more.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">501(c)(3)</dt>
            <dd>
              The IRS lists the organization under subsection 501(c)(3), which generally makes
              donations tax-deductible. Always confirm deductibility for a specific gift.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Public Charity</dt>
            <dd>
              <strong>Simplification:</strong> we show this badge when the organization has a
              501(c)(3) subsection and an NTEE activity code. That is a reasonable but imperfect
              proxy — some 501(c)(3) organizations (for example private foundations) are not
              public charities. The official classification is on the IRS determination record.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Data Missing</dt>
            <dd>
              ProPublica has no extracted financial data for a recent filing of this
              organization, so no revenue, expenses, or assets are shown. This is common for
              very new organizations or filings that have not been processed yet.
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-500">
          Note: charity names are shown exactly as they appear in IRS records, which can differ
          from public brand names (for example, rebrands, DBAs, and legal-name changes).
        </p>
      </section>

      <section
        aria-labelledby="disclaimer-heading"
        className="rounded-xl bg-amber-50 p-6 ring-1 ring-amber-200"
      >
        <h2 id="disclaimer-heading" className="text-xl font-bold text-amber-900">
          Disclaimer
        </h2>
        <p className="mt-2 text-amber-900">
          Informational only — verify at{' '}
          <a
            href="https://apps.irs.gov/app/eos/"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline hover:no-underline"
          >
            apps.irs.gov
          </a>{' '}
          before donating. CharityCheck is an independent project and is not affiliated with the
          IRS or ProPublica. Financial figures are as self-reported by organizations on Form 990.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        Ready to look around? <Link to="/browse" className="font-medium text-emerald-700 hover:underline">Browse the dataset</Link>.
      </p>
    </div>
  )
}
