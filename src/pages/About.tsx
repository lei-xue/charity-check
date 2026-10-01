import { Link } from 'react-router-dom'
import { charities, datasetGeneratedDateLabel } from '../data/charities'

export function About() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">About CharityCheck</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          CharityCheck is a free, ad-free tool that shows U.S. donors public records and historical,
          self-reported Form 990 figures for a charity before donating. It is built entirely on
          public IRS data and is informational only — it does not certify that any organization is
          trustworthy, currently tax-exempt, or in good standing.
        </p>
      </div>

      <section aria-labelledby="provenance-heading" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 id="provenance-heading" className="text-xl font-bold text-slate-900">
          Where the data comes from
        </h2>
        <p className="mt-2 text-slate-600">
          Organization records and historical IRS filing figures are accessed
          through the{' '}
          <a
            href="https://projects.propublica.org/nonprofits/api"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-700 hover:underline"
          >
            ProPublica Nonprofit Explorer API v2
          </a>
          . ProPublica processes IRS e-file data and publishes it for free. No figure is estimated
          or manually edited — each dollar figure is taken from the API exactly as the organization
          reported it.
        </p>
        <p className="mt-2 text-slate-600">
          The curated snapshot of {charities.length} selected U.S. charitable organizations is not a
          complete registry. This dataset snapshot was generated on {datasetGeneratedDateLabel()};
          records may have been retrieved earlier, and figures reflect each organization&apos;s most
          recent filing available in the source data, not real-time data. The optional broader lookup
          queries the same API through our bounded Cloudflare Worker. Submitting sends your query
          to Cloudflare and ProPublica; local browsing does not. Name results retain every record
          on each source page, with Previous/Next navigation. ProPublica caps broad searches at
          10,000 matches, so a capped result is not a complete count of all possible matches.
        </p>
      </section>

      <section aria-labelledby="boundaries-heading" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 id="boundaries-heading" className="text-xl font-bold text-slate-900">
          What CharityCheck is — and is not
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-slate-600">
          <li>
            It shows what public records and historical, self-reported filings contain at a snapshot
            date. It is not a trust rating, a legitimacy certification, or a fraud check.
          </li>
          <li>
            It shows <em>historical</em> filings. A recorded tax period describes a past year, not
            an organization&apos;s current financial health.
          </li>
          <li>
            The &ldquo;live lookup&rdquo; is a fresh ProPublica query, not a live IRS status check.
            For current tax-exempt status and deductibility, use the official IRS sources linked
            here.
          </li>
          <li>
            Missing data is about the availability of extracted filings, not a statement about the
            organization.
          </li>
        </ul>
      </section>

      <section aria-labelledby="badges-heading" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 id="badges-heading" className="text-xl font-bold text-slate-900">
          What the labels mean — and their limits
        </h2>
        <dl className="mt-3 flex flex-col gap-3 text-slate-600">
          <div>
            <dt className="font-semibold text-slate-900">ProPublica record</dt>
            <dd>
              A record for this organization was retrieved from ProPublica&apos;s public
              IRS-form data at the snapshot date. Every charity here carries this label; it means
              the record was found — nothing more. It is not a verification or endorsement.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">501(c)(3) (as reported)</dt>
            <dd>
              The source record lists the organization under subsection 501(c)(3) at the snapshot
              date. This is a source-reported, historical value — not an independent confirmation
              that the organization is currently eligible for tax-deductible donations. Always
              confirm deductibility for a specific gift with the IRS.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Filing data unavailable</dt>
            <dd>
              ProPublica had no extracted financial filing for this organization at the snapshot
              date, so no revenue, expenses, or assets are shown. This describes the availability
              of extracted filing data only — it is not a claim that the organization is opaque,
              hiding finances, or fraudulent. It is common for new organizations and for filings
              that have not been processed yet.
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-500">
          Note: charity names are shown exactly as they appear in IRS records, which can differ
          from public brand names (for example, rebrands, DBAs, and legal-name changes). Financial
          values shown as &ldquo;$0&rdquo; were reported as zero; values shown as &ldquo;Not
          reported&rdquo; were absent from the extracted filing.
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
          IRS or ProPublica. Financial figures are historical and as self-reported by organizations
          on Form 990.
        </p>
      </section>

      <p className="text-sm text-slate-500">
        Ready to look around? <Link to="/browse" className="font-medium text-brand-700 hover:underline">Browse the dataset</Link>.
      </p>
    </div>
  )
}
