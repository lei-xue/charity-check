import type { Badge, Charity } from './types'

export const CAUSE_BY_LETTER: Record<string, string> = {
  A: 'Arts, Culture & Humanities',
  B: 'Education',
  C: 'Environment',
  D: 'Animal-Related',
  E: 'Health',
  F: 'Mental Health & Crisis Intervention',
  G: 'Voluntary Health Associations',
  H: 'Medical Research',
  I: 'Crime & Legal-Related',
  J: 'Employment',
  K: 'Food, Agriculture & Nutrition',
  L: 'Housing & Shelter',
  M: 'Public Safety',
  N: 'Recreation & Sports',
  O: 'Youth Development',
  P: 'Human Services',
  Q: 'International & Foreign Affairs',
  R: 'Civil Rights & Advocacy',
  S: 'Community Improvement',
  T: 'Philanthropy & Grantmaking',
  U: 'Science & Technology',
  V: 'Social Science',
  W: 'Public & Societal Benefit',
  X: 'Religion-Related',
}

export function causeFromNtee(nteeCode: string | null | undefined): string {
  const letter = nteeCode?.charAt(0).toUpperCase() ?? ''
  return CAUSE_BY_LETTER[letter] ?? 'Other'
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '—'
  }
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const trim = (value: number) => {
    const fixed = value.toFixed(1)
    return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
  }
  if (abs >= 1e12) return `${sign}$${trim(abs / 1e12)}T`
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}K`
  return `${sign}$${Math.round(abs)}`
}

export function formatEin(ein: number): string {
  const digits = String(ein)
  return digits.length === 9 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits
}

export function formatTaxPeriod(taxPeriod: number | null | undefined): string {
  if (taxPeriod === null || taxPeriod === undefined || !Number.isFinite(taxPeriod)) {
    return 'Unknown period'
  }
  const year = Math.floor(taxPeriod / 100)
  const month = taxPeriod % 100
  if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, '0')}`
  return String(year)
}

export function rulingYear(rulingDate: string | null | undefined): string | null {
  if (!rulingDate) return null
  const year = rulingDate.slice(0, 4)
  return /^\d{4}$/.test(year) ? year : null
}

export function getBadges(
  org: Pick<Charity, 'subsectionCode' | 'nteeCode' | 'latestFiling'>,
): Badge[] {
  const badges: Badge[] = [{ label: 'Verified', tone: 'emerald' }]
  if (org.subsectionCode === 3) {
    badges.push({ label: '501(c)(3)', tone: 'teal' })
  }
  if (org.subsectionCode === 3 && Boolean(org.nteeCode)) {
    badges.push({ label: 'Public Charity', tone: 'sky' })
  }
  if (!org.latestFiling) {
    badges.push({ label: 'Data Missing', tone: 'amber' })
  }
  return badges
}
