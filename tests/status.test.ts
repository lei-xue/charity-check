import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  causeFromNtee,
  formatEin,
  formatTaxPeriod,
  getBadges,
  rulingYear,
} from '../src/lib/status.ts'

test('getBadges always marks a successful result as Verified', () => {
  const badges = getBadges({ subsectionCode: 3, nteeCode: 'P210', latestFiling: null })
  assert.equal(badges[0].label, 'Verified')
})

test('getBadges emits 501(c)(3) only for subsectionCode 3', () => {
  const with3 = getBadges({ subsectionCode: 3, nteeCode: 'E01', latestFiling: null })
  assert.ok(with3.some((badge) => badge.label === '501(c)(3)'))

  const withOther = getBadges({ subsectionCode: 4, nteeCode: 'E01', latestFiling: null })
  assert.ok(!withOther.some((badge) => badge.label === '501(c)(3)'))
})

test('getBadges emits Public Charity only with subsection 3 and an NTEE code', () => {
  const both = getBadges({ subsectionCode: 3, nteeCode: 'B21', latestFiling: null })
  assert.ok(both.some((badge) => badge.label === 'Public Charity'))

  const noNtee = getBadges({ subsectionCode: 3, nteeCode: null, latestFiling: null })
  assert.ok(!noNtee.some((badge) => badge.label === 'Public Charity'))

  const wrongSubsection = getBadges({ subsectionCode: 7, nteeCode: 'B21', latestFiling: null })
  assert.ok(!wrongSubsection.some((badge) => badge.label === 'Public Charity'))
})

test('getBadges emits Data Missing when there is no latest filing', () => {
  const missing = getBadges({ subsectionCode: 3, nteeCode: 'P20', latestFiling: null })
  assert.ok(missing.some((badge) => badge.label === 'Data Missing'))

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
  assert.ok(!present.some((badge) => badge.label === 'Data Missing'))
})

test('getBadges uses one tone per label', () => {
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

test('formatTaxPeriod renders tax_prd as year-month', () => {
  assert.equal(formatTaxPeriod(202306), '2023-06')
  assert.equal(formatTaxPeriod(199001), '1990-01')
  assert.equal(formatTaxPeriod(202512), '2025-12')
  assert.equal(formatTaxPeriod(null), 'Unknown period')
})

test('formatEin inserts the dash for 9-digit EINs only', () => {
  assert.equal(formatEin(530196605), '53-0196605')
  assert.equal(formatEin(990192064), '99-0192064')
  assert.equal(formatEin(1234), '1234')
})

test('rulingYear extracts the 4-digit year from the ruling date', () => {
  assert.equal(rulingYear('1938-12-01'), '1938')
  assert.equal(rulingYear('2020-06-15'), '2020')
  assert.equal(rulingYear(null), null)
  assert.equal(rulingYear(''), null)
})
