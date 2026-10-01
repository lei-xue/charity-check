import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  causeFromNtee,
  formatEin,
  formatTaxPeriod,
  getBadges,
  rulingYear,
} from '../src/lib/status.ts'

test('getBadges labels the source record instead of certifying it as Verified', () => {
  const badges = getBadges({ subsectionCode: 3, nteeCode: 'P210', latestFiling: null })
  assert.equal(badges[0].label, 'ProPublica record')
  assert.ok(!badges.some((badge) => /verified/i.test(badge.label)))
})

test('getBadges never infers Public Charity from 501(c)(3) + NTEE', () => {
  const badges = getBadges({ subsectionCode: 3, nteeCode: 'B21', latestFiling: null })
  assert.ok(!badges.some((badge) => /public charity/i.test(badge.label)))
})

test('getBadges marks 501(c)(3) as source-reported, not confirmed eligibility', () => {
  const with3 = getBadges({ subsectionCode: 3, nteeCode: 'E01', latestFiling: null })
  const labels3 = with3.map((badge) => badge.label)
  assert.ok(
    labels3.some((label) => /^501\(c\)\(3\)/.test(label) && /as reported/i.test(label)),
    `expected a source-reported 501(c)(3) label, got ${JSON.stringify(labels3)}`,
  )

  const withOther = getBadges({ subsectionCode: 4, nteeCode: 'E01', latestFiling: null })
  assert.ok(!withOther.some((badge) => badge.label.startsWith('501(c)(3)')))
})

test('getBadges reports unavailable extracted filing without a fraud claim', () => {
  const missing = getBadges({ subsectionCode: 3, nteeCode: 'P20', latestFiling: null })
  const amber = missing.filter((badge) => badge.tone === 'amber').map((badge) => badge.label)
  assert.equal(amber.length, 1, 'expected exactly one amber filing-status label')
  assert.match(amber[0], /filing/i)
  assert.ok(!/fraud|opaque|missing data/i.test(amber[0]))

  const present = getBadges({
    subsectionCode: 3,
    nteeCode: 'P20',
    latestFiling: {
      taxPeriod: 202306,
      totalRevenue: 1,
      totalExpenses: 1,
      totalAssets: 1,
      pdfUrl: null,
    },
  })
  assert.ok(!present.some((badge) => badge.tone === 'amber'))
})

test('getBadges uses one tone per label and no duplicate labels', () => {
  const badges = getBadges({ subsectionCode: 3, nteeCode: 'P20', latestFiling: null })
  const labels = badges.map((badge) => badge.label)
  assert.equal(new Set(labels).size, labels.length)
  for (const badge of badges) {
    assert.equal(typeof badge.tone, 'string')
  }
})

test('causeFromNtee maps common NTEE first letters', () => {
  assert.equal(causeFromNtee('E210'), 'Health')
  assert.equal(causeFromNtee('B90'), 'Education')
  assert.equal(causeFromNtee('P80'), 'Human Services')
  assert.equal(causeFromNtee('D30'), 'Animal-Related')
  assert.equal(causeFromNtee('C50'), 'Environment')
  assert.equal(causeFromNtee('Q30'), 'International & Foreign Affairs')
})

test('causeFromNtee is case-insensitive and tolerates missing codes', () => {
  assert.equal(causeFromNtee('e01'), 'Health')
  assert.equal(causeFromNtee(null), 'Other')
  assert.equal(causeFromNtee(undefined), 'Other')
  assert.equal(causeFromNtee(''), 'Other')
  assert.equal(causeFromNtee('Z99'), 'Other')
})

test('formatTaxPeriod renders tax_prd as year-month and never invents a period', () => {
  assert.equal(formatTaxPeriod(202306), '2023-06')
  assert.equal(formatTaxPeriod(199001), '1990-01')
  assert.equal(formatTaxPeriod(202512), '2025-12')
  assert.equal(formatTaxPeriod(null), 'Unknown period')
  assert.equal(formatTaxPeriod(undefined), 'Unknown period')
})

test('formatEin pads numeric source identifiers to canonical 9-digit display', () => {
  assert.equal(formatEin(530196605), '53-0196605')
  assert.equal(formatEin(990192064), '99-0192064')
  assert.equal(formatEin(42263040), '04-2263040')
  assert.equal(formatEin(10471949), '01-0471949')
})

test('formatEin degrades safely for non-finite input', () => {
  assert.equal(formatEin(Number.NaN), '')
  assert.equal(formatEin(Number.POSITIVE_INFINITY), '')
})

test('rulingYear extracts the 4-digit year from the ruling date', () => {
  assert.equal(rulingYear('1938-12-01'), '1938')
  assert.equal(rulingYear('2020-06-15'), '2020')
  assert.equal(rulingYear(null), null)
  assert.equal(rulingYear(''), null)
})
