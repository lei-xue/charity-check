import charitiesJson from './charities.json'
import datasetMetaJson from './dataset-meta.json'
import type { Charity } from '../lib/types'
import { CAUSE_BY_LETTER, resolveCuratedRouteIn } from '../lib/status'

export const charities = charitiesJson as Charity[]

export interface DatasetMeta {
  generatedAt: string
  source: string
  count: number
}

export const datasetMeta = datasetMetaJson as DatasetMeta

/** Human-readable snapshot date for the curated dataset. */
export function snapshotDateLabel(): string {
  const date = new Date(datasetMeta.generatedAt)
  if (Number.isNaN(date.getTime())) return 'unknown date'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function findByEin(ein: number): Charity | undefined {
  return charities.find((charity) => charity.ein === ein)
}

/**
 * Resolve an `/org/:ein` route parameter against the curated dataset.
 *
 * Canonical EINs match on padded nine digits, so leading-zero records are
 * reachable; a bare numeric parameter is kept as a narrow legacy case for
 * links built from the stored number. Anything malformed resolves to
 * undefined without touching the live API. The immutable dataset is never
 * rewritten by this lookup.
 */
export function resolveCuratedRoute(param: string): Charity | undefined {
  return resolveCuratedRouteIn(charities, param)
}

export const allStates: string[] = [
  ...new Set(
    charities.map((charity) => charity.state).filter((state): state is string => Boolean(state)),
  ),
].sort()

export interface CauseSummary {
  letter: string
  label: string
  count: number
}

export function getCauseSummaries(): CauseSummary[] {
  const counts = new Map<string, number>()
  for (const charity of charities) {
    const letter = (charity.nteeCode?.charAt(0) ?? '').toUpperCase()
    if (!letter) continue
    counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([letter, count]) => ({
      letter,
      label: CAUSE_BY_LETTER[letter] ?? 'Other',
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export const latestTaxYear: number = charities.reduce((max, charity) => {
  const taxPeriod = charity.latestFiling?.taxPeriod
  if (!taxPeriod) return max
  return Math.max(max, Math.floor(taxPeriod / 100))
}, 0)
