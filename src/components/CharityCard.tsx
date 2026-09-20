import { Link } from 'react-router-dom'
import { causeFromNtee, formatEin, formatMoney, getBadges } from '../lib/status'
import type { Charity } from '../lib/types'
import { BadgeList } from './Badge'

export function CharityCard({ org }: { org: Charity }) {
  const revenue = org.revenueAmount ?? org.latestFiling?.totalRevenue ?? null
  const location = [org.city, org.state].filter(Boolean).join(', ')
  return (
    <li>
      <Link
        to={`/org/${org.ein}`}
        className="block h-full rounded-xl bg-white p-5 ring-1 ring-slate-200 transition hover:shadow-sm hover:ring-emerald-400"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug text-slate-900">{org.name}</h3>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
            {formatEin(org.ein)}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-slate-500">
          {location || 'Location not listed'} · {causeFromNtee(org.nteeCode)}
        </p>
        <p className="mt-3 text-sm">
          <span className="font-medium text-slate-500">Revenue</span>{' '}
          <span className="font-semibold text-slate-900">{formatMoney(revenue)}</span>
        </p>
        <div className="mt-3">
          <BadgeList badges={getBadges(org)} />
        </div>
      </Link>
    </li>
  )
}
