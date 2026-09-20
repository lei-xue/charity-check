import { causeFromNtee } from './status'
import type { Charity } from './types'

export function causeLetter(org: Charity): string {
  return (org.nteeCode?.charAt(0) ?? '').toUpperCase()
}

export interface CharityFilters {
  q?: string
  state?: string
  cause?: string
  minRevenue?: number
  maxRevenue?: number
}

function matchesQuery(org: Charity, rawQuery: string): boolean {
  const needle = rawQuery.trim().toLowerCase()
  if (!needle) return true
  const digits = needle.replace(/\D+/g, '')
  if (digits.length >= 7 && String(org.ein).includes(digits)) return true
  return (
    org.name.toLowerCase().includes(needle) ||
    (org.city?.toLowerCase().includes(needle) ?? false) ||
    (org.state?.toLowerCase() === needle)
  )
}

export function filterCharities(charities: Charity[], filters: CharityFilters): Charity[] {
  return charities.filter((org) => {
    if (filters.q && !matchesQuery(org, filters.q)) return false
    if (filters.state && org.state?.toUpperCase() !== filters.state.toUpperCase()) return false
    if (filters.cause && causeLetter(org) !== filters.cause.toUpperCase()) return false
    const revenue = org.revenueAmount
    if (
      filters.minRevenue !== undefined &&
      (revenue === null || revenue < filters.minRevenue)
    ) {
      return false
    }
    if (
      filters.maxRevenue !== undefined &&
      (revenue === null || revenue > filters.maxRevenue)
    ) {
      return false
    }
    return true
  })
}

export { causeFromNtee }
