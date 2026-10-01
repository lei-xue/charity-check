import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Schema test over the REAL generated dataset (not a fixture).
const raw = readFileSync(new URL('../src/data/charities.json', import.meta.url), 'utf8')
const charities: unknown = JSON.parse(raw)
const expansionEins: number[] = JSON.parse(
  readFileSync(new URL('../scripts/curated-expansion-eins.json', import.meta.url), 'utf8'),
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

test('charities.json contains the approved 500-record curated snapshot', () => {
  assert.ok(Array.isArray(charities), 'charities.json must be an array')
  assert.equal(charities.length, 500, `expected exactly 500 entries, got ${charities.length}`)
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

test('all expansion EINs resolve to current 501(c)(3) records', () => {
  const byEin = new Map((charities as { ein: number; subsectionCode: number }[]).map((org) => [org.ein, org]))
  assert.equal(expansionEins.length, 389)
  for (const ein of expansionEins) {
    assert.equal(byEin.get(ein)?.subsectionCode, 3, `EIN ${ein} must be present as 501(c)(3)`)
  }
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

test('source completeness: snapshot metadata matches the curated record count', () => {
  const meta = JSON.parse(
    readFileSync(new URL('../src/data/dataset-meta.json', import.meta.url), 'utf8'),
  ) as { count: number; generatedAt: string; source: string }
  assert.equal(meta.count, (charities as unknown[]).length)
  assert.ok(
    (charities as unknown[]).length >= 111,
    'the curated snapshot must keep at least the 111 curated records',
  )
  assert.ok(!Number.isNaN(new Date(meta.generatedAt).getTime()), 'generatedAt must be a valid date')
})

test('every record carries a usable numeric source identifier', () => {
  for (const entry of charities as Record<string, unknown>[]) {
    assert.equal(typeof entry.ein, 'number', `ein must be numeric for ${entry.name}`)
    const ein = entry.ein as number
    assert.ok(Number.isInteger(ein), `ein must be an integer for ${entry.name}`)
    assert.ok(ein > 0 && ein <= 999999999, `ein out of range for ${entry.name}: ${ein}`)
    assert.ok(String(ein).length <= 9, `ein must fit 9 digits for ${entry.name}: ${ein}`)
  }
})

test('missing amounts and real zeros are both represented and kept distinct', () => {
  const records = charities as Record<string, unknown>[]
  const withNullAmount = records.filter((entry) => entry.revenueAmount === null)
  const withZeroAmount = records.filter(
    (entry) => entry.revenueAmount === 0 || entry.assetAmount === 0 || entry.incomeAmount === 0,
  )
  assert.ok(withNullAmount.length >= 1, 'expected at least one record with a missing (null) amount')
  assert.ok(withZeroAmount.length >= 1, 'expected at least one record with a real zero amount')
  const withNoFiling = records.filter((entry) => entry.latestFiling === null)
  assert.ok(withNoFiling.length >= 1, 'expected at least one record with no extracted filing')
})
