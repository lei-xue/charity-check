import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { charities } from '../data/charities'
import { classifyEinQuery, formatEin, formatMoney, formatTaxPeriod } from '../lib/status'
import { lookup, type LookupPage } from '../lib/lookup'

type Status = 'idle' | 'loading' | 'invalid' | 'error' | 'done'
const BUTTON = 'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 min-h-11'

export function LiveLookup({ initialQuery = '', searchQuery }: { initialQuery?: string; searchQuery?: string }) {
  const [typedQuery, setTypedQuery] = useState(initialQuery)
  const query = searchQuery ?? typedQuery
  const [storedStatus, setStatus] = useState<Status>('idle')
  const [data, setData] = useState<LookupPage | null>(null)
  const [submitted, setSubmitted] = useState('')
  const status = submitted === query.trim() ? storedStatus : 'idle'
  const [message, setMessage] = useState('')
  const current = useRef<{token:number; controller:AbortController | null}>({token:0,controller:null})

  function invalidate() {
    current.current.token++
    current.current.controller?.abort()
    current.current.controller = null
  }
  useEffect(() => {
    invalidate()
    return invalidate
  }, [query])

  async function run(term: string, page = 0) {
    invalidate()
    const token = current.current.token
    const input = classifyEinQuery(term)
    setSubmitted(input.value)
    if (!input.value) return
    if (input.kind === 'invalid-ein' || input.value.length > 200) {
      setData(null)
      setMessage('Enter nine digits or XX-XXXXXXX for an EIN, or an organization name of at most 200 characters. Nothing was sent.')
      setStatus('invalid')
      return
    }
    const controller = new AbortController()
    current.current.controller = controller
    setStatus('loading')
    setData(null)
    try {
      const result = await lookup(input.value, page, controller.signal)
      if (token !== current.current.token) return
      setData(result)
      setStatus('done')
    } catch (error) {
      if (token !== current.current.token) return
      setMessage(error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The lookup timed out. Retry or continue with the local snapshot.'
        : 'ProPublica lookup is unavailable or returned an invalid response. Retry or continue with the local snapshot.')
      setStatus('error')
    } finally {
      if (token === current.current.token) current.current.controller = null
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(query)
  }
  const sourceSearch = `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(submitted || query)}`
  const submittedIsEin = classifyEinQuery(submitted).kind === 'ein'

  return (
    <section aria-labelledby="live-lookup-heading" className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h2 id="live-lookup-heading" className="text-lg font-semibold text-slate-900">Broader ProPublica lookup</h2>
      <p className="mt-1 text-sm text-slate-500">
        Submitting sends the name or EIN through our Cloudflare Worker to ProPublica. Local filters do not apply;
        a fresh response is not current IRS verification.
      </p>
      {searchQuery === undefined ? (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="text" value={typedQuery} onChange={event => {invalidate(); setStatus('idle'); setData(null); setTypedQuery(event.target.value)}}
            placeholder="Organization name or XX-XXXXXXX" aria-label="EIN or organization name"
            aria-invalid={status === 'invalid'} aria-describedby={status === 'invalid' ? 'lookup-message' : undefined}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:ring-2 focus:ring-brand-500" />
          <button type="submit" disabled={!query.trim()} className={BUTTON}>Look up</button>
        </form>
      ) : (
        <button type="button" onClick={() => void run(query)} disabled={!query.trim()} className={`${BUTTON} mt-3`}>
          Look up this name or EIN
        </button>
      )}
      {status === 'loading' && (
        <div className="mt-3 flex items-center gap-3">
          <p role="status" className="text-sm text-slate-500">Contacting ProPublica…</p>
          <button type="button" onClick={() => {invalidate(); setStatus('idle')}} className="text-sm text-brand-700 underline">Cancel lookup</button>
        </div>
      )}
      {(status === 'invalid' || status === 'error') && (
        <div className="mt-3 text-sm text-amber-900">
          <p id="lookup-message" role="alert">{message}</p>
          {status === 'error' && <button type="button" onClick={() => void run(submitted)} className="mt-2 font-semibold underline">Retry lookup</button>}
        </div>
      )}
      {status === 'done' && data?.total === 0 && (
        <div role="status" className="mt-3 space-y-2 text-sm text-slate-600">
          <p>No match found for that search. This does not mean the organization is not registered — searches can miss legal names or newly registered organizations.</p>
          <p>{submittedIsEin ? 'Check the organization’s legal name in the IRS search.' : 'Try its 9-digit EIN or exact IRS legal name.'} For an official tax-exempt status check, use the{' '}
            <a href="https://apps.irs.gov/app/eos/" target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline hover:no-underline">
              IRS Tax Exempt Organization Search (TEOS)
            </a>.
          </p>
        </div>
      )}
      {status === 'done' && data && data.total > 0 && (
        <div className="mt-4">
          <p role="status" className="text-sm text-slate-600">
            {`Source page ${data.page + 1} of ${data.pages}: ${data.results.length} records; ${data.total.toLocaleString('en-US')} source-reported matches.`}
          </p>
          {data.sourceLimit && <p className="mt-1 text-sm text-slate-500">ProPublica caps this search at 10,000 results; this is not a complete count of all possible matches. Narrow the name.</p>}
          <ul className="mt-2 divide-y divide-slate-100">
            {data.results.map(result => (
              <li key={result.ein} className="py-3">
                <h3 className="font-semibold text-slate-900">{result.name}</h3>
                <p className="mt-1 text-sm text-slate-500">EIN {formatEin(result.ein)} · {result.location || 'Location not listed'} · {result.cause}{result.is501c3 ? ' · 501(c)(3) (as reported)' : ''}</p>
                {(result.revenue !== null || result.assets !== null) && <p className="mt-1 text-sm text-slate-600">Revenue {result.revenue === null ? 'Not reported' : formatMoney(result.revenue)} · Assets {result.assets === null ? 'Not reported' : formatMoney(result.assets)} · Tax period {formatTaxPeriod(result.taxPeriod)}</p>}
                <p className="mt-1 text-sm">
                  <a href={`https://projects.propublica.org/nonprofits/organizations/${String(result.ein).padStart(9,'0')}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">View source record →</a>
                  {charities.some(org => org.ein === result.ein) && <>{' · '}<Link to={`/org/${result.ein}`} className="text-brand-700 hover:underline">View local snapshot</Link></>}
                  {result.pdfUrl && <>{' · '}<a href={result.pdfUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">Form 990 PDF</a></>}
                </p>
              </li>
            ))}
          </ul>
          {data.pages > 1 && <nav aria-label="ProPublica result pages" className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={data.page===0} onClick={() => void run(submitted,data.page-1)} className={BUTTON}>Previous source page</button>
            <button type="button" disabled={data.page+1>=data.pages} onClick={() => void run(submitted,data.page+1)} className={BUTTON}>Next source page</button>
          </nav>}
          <a href={sourceSearch} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brand-700 underline">Continue on ProPublica</a>
        </div>
      )}
    </section>
  )
}
