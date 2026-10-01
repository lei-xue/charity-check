import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { filterCharities } from '../src/lib/query.ts'
import type { Charity } from '../src/lib/types.ts'

const records: Charity[] = JSON.parse(readFileSync(new URL('../src/data/charities.json', import.meta.url), 'utf8'))
const fixture: Charity = {
  ein: 12345678, name: 'Example Foundation', city: 'Boston', state: 'MA',
  nteeCode: 'B20', subsectionCode: 3, rulingDate: null,
  assetAmount: null, incomeAmount: null, revenueAmount: 100, latestFiling: null,
}

test('EIN search retains leading zeros omitted by numeric storage', () => {
  for (const q of ['01-2345678', '012345678']) {
    assert.deepEqual(filterCharities([fixture], { q }), [fixture])
  }
})

test('mixed text and digits must not silently become an EIN search', () => {
  assert.deepEqual(filterCharities([fixture], { q: 'unrelated 12345678' }), [])
})

test('every real record can be retrieved with its full formatted EIN', () => {
  for (const org of records) {
    const digits = String(org.ein).padStart(9, '0')
    const q = `${digits.slice(0, 2)}-${digits.slice(2)}`
    assert.deepEqual(filterCharities(records, { q }).map(result => result.ein), [org.ein])
  }
})

test('name, city and state search is case insensitive and trims whitespace', () => {
  for (const q of [' example ', 'BOSTON', 'ma', '  ']) {
    assert.deepEqual(filterCharities([fixture], { q }), [fixture])
  }
})

test('filters combine and revenue bounds are inclusive', () => {
  assert.deepEqual(filterCharities([fixture], { state: 'ma', cause: 'b', minRevenue: 100, maxRevenue: 100 }), [fixture])
  for (const filters of [{ state: 'CA' }, { cause: 'E' }, { minRevenue: 101 }, { maxRevenue: 99 }]) {
    assert.deepEqual(filterCharities([fixture], filters), [])
  }
})

test('unknown revenue is not treated as zero when filtering', () => {
  const missing = { ...fixture, revenueAmount: null }
  assert.deepEqual(filterCharities([missing], {}), [missing])
  assert.deepEqual(filterCharities([missing], { minRevenue: 0 }), [])
  assert.deepEqual(filterCharities([missing], { maxRevenue: 100 }), [])
})
