import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Schema test over the REAL generated dataset (not a fixture).
const raw = readFileSync(new URL('../src/data/charities.json', import.meta.url), 'utf8')
const charities: unknown = JSON.parse(raw)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

test('charities.json is an array with at least 25 entries', () => {
  assert.ok(Array.isArray(charities), 'charities.json must be an array')
  assert.ok(charities.length >= 25, `expected >= 25 entries, got ${charities.length}`)
})

test('every entry has required fields with correct types', () => {
  for (const entry of charities as unknown[]) {
    assert.ok(isRecord(entry), 'each entry must be an object')
    assert.equal(typeof entry.ein, 'number', `ein must be a number for ${entry.name}`)
    assert.equal(
      typeof entry.name,
      'string',
      `name must be a string for EIN ${entry.ein}`,
    )
    assert.ok((entry.name as string).length > 0, `name must be non-empty for EIN ${entry.ein}`)
    assert.equal(
      typeof entry.subsectionCode,
      'number',
      `subsectionCode must be a number for ${entry.name}`,
    )
    assert.ok('state' in entry, `state key must exist for ${entry.name}`)
    assert.ok('city' in entry, `city key must exist for ${entry.name}`)
    assert.ok('nteeCode' in entry, `nteeCode key must exist for ${entry.name}`)
    assert.ok('rulingDate' in entry, `rulingDate key must exist for ${entry.name}`)
    assert.ok('assetAmount' in entry, `assetAmount key must exist for ${entry.name}`)
    assert.ok('incomeAmount' in entry, `incomeAmount key must exist for ${entry.name}`)
    assert.ok('revenueAmount' in entry, `revenueAmount key must exist for ${entry.name}`)
  }
})

test('EINs are unique', () => {
  const eins = (charities as { ein: number }[]).map((charity) => charity.ein)
  assert.equal(new Set(eins).size, eins.length, 'duplicate EINs found')
})

test('latestFiling is null or a well-shaped object', () => {
  for (const entry of charities as { latestFiling: unknown; name: string }[]) {
    if (entry.latestFiling === null) continue
    assert.ok(
      isRecord(entry.latestFiling),
      `latestFiling must be an object or null for ${entry.name}`,
    )
    const filing = entry.latestFiling
    for (const key of ['taxPeriod', 'totalRevenue', 'totalExpenses', 'totalAssets', 'pdfUrl']) {
      assert.ok(key in filing, `latestFiling.${key} must exist for ${entry.name}`)
      const value = filing[key]
      const allowed = key === 'pdfUrl' ? 'string' : 'number'
      assert.ok(
        value === null || typeof value === allowed,
        `latestFiling.${key} must be ${allowed} or null for ${entry.name}`,
      )
    }
  }
})

test('financial amounts are numbers or null, never fabricated strings', () => {
  for (const entry of charities as Record<string, unknown>[]) {
    for (const key of ['assetAmount', 'incomeAmount', 'revenueAmount']) {
      assert.ok(
        entry[key] === null || typeof entry[key] === 'number',
        `${key} must be a number or null for ${entry.name}`,
      )
    }
  }
})
