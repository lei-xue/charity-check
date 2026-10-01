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

// ---------------------------------------------------------------------------
// EIN helpers (shared, pure).
//
// Two identifier contracts meet here:
//
// 1. Visitor input is STRICT. A typed EIN must be exactly nine digits, bare
//    (`530196605`) or written as `XX-XXXXXXX` (`53-0196605`). Only outer
//    whitespace is trimmed. Embedded separators, stray characters, decimals,
//    exponents, missing/extra digits and the all-zero EIN are rejected rather
//    than silently repaired.
//
// 2. Upstream / stored identifiers are NUMERIC. The curated dataset and the
//    ProPublica payload store EINs as numbers, which drops leading zeros (EIN
//    042263040 is stored as 42263040). Numbers are padded to the canonical
//    nine-digit form for display and matching only; the stored value and the
//    source identity are never rewritten.
// ---------------------------------------------------------------------------

const EIN_LENGTH = 9
const EIN_INPUT_PATTERN = /^(\d{2})-?(\d{7})$/
const EIN_SHAPED_PATTERN = /^[\d\-\s]+$/
const EIN_ZERO_PATTERN = /^0{9}$/
const EIN_DIGEST_PATTERN = /^\d{7,9}$/

/** Canonical nine-digit string for a numeric source identifier. */
export function einDigits(ein: number): string {
  if (!Number.isInteger(ein) || ein <= 0 || ein > 999999999) return ''
  return String(ein).padStart(EIN_LENGTH, '0')
}

/** Validate upstream representations separately from strict visitor input. */
export function sourceEinDigits(value: unknown): string {
  if (typeof value === 'number') return einDigits(value)
  if (typeof value !== 'string' || !/^\d{1,9}$/.test(value)) return ''
  return einDigits(Number(value))
}

// Actual current source domains, verified against the dataset pdfUrl values.
const SOURCE_PDF_HOSTS = new Set(['projects.propublica.org'])

/**
 * Only clickable links that are genuine HTTPS source PDF URLs. Arbitrary
 * protocols and hosts, URLs with embedded credentials, and non-string input
 * are suppressed rather than rendered.
 */
export function safeDocumentUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return SOURCE_PDF_HOSTS.has(url.hostname) ? url.href : null
  } catch {
    return null
  }
}

/** `XX-XXXXXXX` display for a numeric source identifier. */
export function formatEin(ein: number): string {
  const digits = einDigits(ein)
  return digits.length === EIN_LENGTH ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits
}

export type EinInputError = 'empty' | 'format' | 'zero'

export type EinInputResult = { ok: true; ein: string } | { ok: false; reason: EinInputError }

/** Strict parse of visitor EIN input. Only outer whitespace is trimmed. */
export function parseEinInput(raw: string): EinInputResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, reason: 'empty' }
  const match = EIN_INPUT_PATTERN.exec(trimmed)
  if (!match) return { ok: false, reason: 'format' }
  const digits = `${match[1]}${match[2]}`
  if (EIN_ZERO_PATTERN.test(digits)) return { ok: false, reason: 'zero' }
  return { ok: true, ein: digits }
}

export type EinQueryKind = 'ein' | 'invalid-ein' | 'text'

export interface EinQueryClassification {
  kind: EinQueryKind
  /** Canonical nine-digit EIN when kind is 'ein', otherwise null. */
  ein: string | null
  /** Trimmed input, echoed back for messages. */
  value: string
}

/**
 * Decide how a free-text box should treat its input.
 *
 * 'ein'         — strict, valid EIN; safe to query a specific organization.
 * 'invalid-ein' — EIN-shaped (digits, hyphens and spaces only) but malformed;
 *                 show validation feedback instead of contacting the source.
 * 'text'        — anything containing letters is a name query, even when the
 *                 name contains numbers ("3M Foundation").
 */
export function classifyEinQuery(raw: string): EinQueryClassification {
  const value = raw.trim()
  const parsed = parseEinInput(value)
  if (parsed.ok) return { kind: 'ein', ein: parsed.ein, value }
  const numericNotation = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)
    || /^0x[\da-f]+$/i.test(value)
  if (value !== '' && (EIN_SHAPED_PATTERN.test(value) || numericNotation)) {
    return { kind: 'invalid-ein', ein: null, value }
  }
  return { kind: 'text', ein: null, value }
}

/**
 * Exact local EIN match. Canonical formatted or nine-digit searches reach
 * leading-zero records; the bare numeric stored form is accepted as a narrow
 * legacy case. A substring of an EIN never matches.
 */
export function einMatchesQuery(ein: number, rawQuery: string): boolean {
  const query = classifyEinQuery(rawQuery)
  if (query.kind === 'ein' && query.ein) {
    return einDigits(ein) === query.ein
  }
  if (query.kind === 'invalid-ein') {
    // Only the exact bare stored form (no separators) counts as a legacy
    // match; malformed spellings like "12-3456789" never match.
    if (EIN_DIGEST_PATTERN.test(query.value)) {
      return String(ein) === query.value || einDigits(ein) === query.value
    }
  }
  return false
}

export type RouteEinResolution =
  | { kind: 'canonical'; ein: string }
  | { kind: 'legacy'; ein: number }
  | { kind: 'invalid' }

/**
 * Resolve an `/org/:ein` route parameter. Canonical EINs resolve on padded
 * nine digits (leading-zero records included). The bare stored number is kept
 * as a narrow legacy case for links generated from the dataset. Malformed or
 * embedded-digit routes resolve to 'invalid' so callers can refuse them
 * without touching the live API.
 */
export function resolveRouteEin(param: string): RouteEinResolution {
  const query = classifyEinQuery(param)
  if (query.kind === 'ein' && query.ein) return { kind: 'canonical', ein: query.ein }
  if (query.kind === 'invalid-ein' && EIN_DIGEST_PATTERN.test(query.value)) {
    const numeric = Number(query.value)
    if (numeric > 0) return { kind: 'legacy', ein: numeric }
  }
  return { kind: 'invalid' }
}

/**
 * Resolve an `/org/:ein` route parameter against a record list. Kept generic
 * and pure so the exact same logic runs in the app and in tests over the real
 * dataset. Returns undefined for malformed parameters.
 */
export function resolveCuratedRouteIn<T extends { ein: number }>(
  records: readonly T[],
  param: string,
): T | undefined {
  const resolved = resolveRouteEin(param)
  if (resolved.kind === 'canonical') {
    return records.find((record) => einDigits(record.ein) === resolved.ein)
  }
  if (resolved.kind === 'legacy') {
    return records.find((record) => record.ein === resolved.ein && String(record.ein) === param.trim())
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Live lookup boundary mapping (shared, pure).
//
// The ProPublica payload is untrusted upstream data: entries may be missing,
// null, or carry malformed identifiers and amounts. These helpers fail safely
// — an entry without a usable numeric source identifier is dropped, absent
// amounts stay null (distinct from a reported zero), and only finite-number
// amounts are kept. This is deliberately narrow boundary mapping, not a
// generic validator library.
// ---------------------------------------------------------------------------

export interface LiveResult {
  ein: number
  name: string
  location: string
  cause: string
  is501c3: boolean
  revenue: number | null
  assets: number | null
  taxPeriod: number | null
  pdfUrl: string | null
}

function finiteAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Map one upstream entry to a result, or null when it is unusable. */
export function toLiveResult(value: unknown): LiveResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const digits = sourceEinDigits(raw.ein)
  if (!digits) return null
  const ein = Number(digits)
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : null
  const period = raw.tax_prd
  const taxPeriod = typeof period === 'number' && Number.isInteger(period)
    && period >= 100001 && period <= 999912 && period % 100 >= 1 && period % 100 <= 12
    ? period : null
  return {
    ein,
    name: name ?? `EIN ${formatEin(ein)}`,
    location: [raw.city, raw.state]
      .filter((part): part is string => typeof part === 'string')
      .join(', '),
    cause: causeFromNtee(typeof raw.ntee_code === 'string' ? raw.ntee_code : null),
    is501c3: (raw.subsection_code ?? raw.subseccd) === 3,
    revenue: finiteAmount(raw.totrevenue),
    assets: finiteAmount(raw.totassetsend),
    taxPeriod,
    pdfUrl: safeDocumentUrl(raw.pdf_url),
  }
}

/**
 * Map an upstream organization list. Non-array input (including null and
 * missing fields) yields an empty list; null and malformed entries are
 * dropped rather than crashing the lookup.
 */
export function mapLiveResults(orgs: unknown, limit?: number): LiveResult[] {
  if (!Array.isArray(orgs)) return []
  const entries = limit === undefined ? orgs : orgs.slice(0, limit)
  return entries.map(toLiveResult).filter((result): result is LiveResult => result !== null)
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

export const SOURCE_BADGE_LABEL = 'ProPublica record'

/**
 * Descriptive labels derived from the source record only. These are not a
 * trust, legitimacy or current-eligibility certification: the source badge
 * just says a record was found, and the 501(c)(3) label repeats what the
 * source reported when the record was captured.
 */
export function getBadges(
  org: Pick<Charity, 'subsectionCode' | 'nteeCode' | 'latestFiling'>,
): Badge[] {
  const badges: Badge[] = [{ label: SOURCE_BADGE_LABEL, tone: 'sky' }]
  if (org.subsectionCode === 3) {
    badges.push({ label: '501(c)(3) (as reported)', tone: 'teal' })
  }
  if (!org.latestFiling) {
    badges.push({ label: 'Filing data unavailable', tone: 'amber' })
  }
  return badges
}
