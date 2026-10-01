import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyEinQuery,
  einDigits,
  mapLiveResults,
  resolveCuratedRouteIn,
  safeDocumentUrl,
  sourceEinDigits,
  toLiveResult,
} from '../src/lib/status.ts'

test('numeric source identifiers are validated before display padding', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, 1000000000]) {
    assert.equal(einDigits(value), '', `invalid source ID ${value}`)
  }
})

test('numeric notation is rejected without rejecting numbered organization names', () => {
  for (const value of ['530196605.0', '1.2e8', '5e8', '0x12345678', '+530196605']) {
    assert.equal(classifyEinQuery(value).kind, 'invalid-ein')
  }
  for (const value of ['3M Foundation', 'E22', 'Wildlife Fund 2']) {
    assert.equal(classifyEinQuery(value).kind, 'text')
  }
})

test('legacy routes accept only the exact existing source spelling', () => {
  const rows = [{ ein: 42263040 }]
  assert.equal(resolveCuratedRouteIn(rows, '42263040'), rows[0])
  assert.equal(resolveCuratedRouteIn(rows, '042263040'), rows[0])
  assert.equal(resolveCuratedRouteIn(rows, '0042263040'), undefined)
  assert.equal(resolveCuratedRouteIn(rows, '00422630'), undefined)
})

test('sourceEinDigits rejects invalid source numbers and non-numeric strings', () => {
  for (const value of [0, -5, 1.5, NaN, Infinity, 1000000000, '12-3456789', '1.2e8', 'abc', '', ' 12345 ']) {
    assert.equal(sourceEinDigits(value), '', `invalid source value ${JSON.stringify(value)}`)
  }
  assert.equal(sourceEinDigits(530196605), '530196605')
  assert.equal(sourceEinDigits(42263040), '042263040')
  assert.equal(sourceEinDigits('530196605'), '530196605')
  assert.equal(sourceEinDigits('42263040'), '042263040')
})

test('toLiveResult drops malformed identifiers and maps valid entries', () => {
  assert.equal(toLiveResult(null), null)
  assert.equal(toLiveResult('530196605'), null)
  assert.equal(toLiveResult([{ ein: 530196605 }]), null)
  assert.equal(toLiveResult({ ein: 0 }), null)
  assert.equal(toLiveResult({ ein: -1 }), null)
  assert.equal(toLiveResult({ ein: 1.5 }), null)
  assert.equal(toLiveResult({ ein: 1000000000 }), null)
  assert.equal(toLiveResult({ ein: '12-3456789' }), null)

  const result = toLiveResult({ ein: 530196605, name: 'ACLU', city: 'New York', state: 'NY', ntee_code: 'R20', subsection_code: 3, totrevenue: 100, totassetsend: 50, pdf_url: 'https://projects.propublica.org/nonprofits/download-filing?path=x.pdf' })
  assert.ok(result)
  assert.equal(result.ein, 530196605)
  assert.equal(result.is501c3, true)
  assert.equal(result.revenue, 100)

  const noName = toLiveResult({ ein: 530196605 })
  assert.ok(noName)
  assert.equal(noName.name, 'EIN 53-0196605')
  assert.equal(noName.revenue, null)
  assert.equal(noName.assets, null)
})

test('toLiveResult keeps reported zero amounts distinct from absent amounts', () => {
  const zero = toLiveResult({ ein: 530196605, totrevenue: 0, totassetsend: 0 })
  assert.ok(zero)
  assert.equal(zero.revenue, 0)
  assert.equal(zero.assets, 0)

  const absent = toLiveResult({ ein: 530196605 })
  assert.ok(absent)
  assert.equal(absent.revenue, null)
  assert.equal(absent.assets, null)

  const nonFinite = toLiveResult({ ein: 530196605, totrevenue: NaN, totassetsend: Infinity })
  assert.ok(nonFinite)
  assert.equal(nonFinite.revenue, null)
  assert.equal(nonFinite.assets, null)

  const wrongType = toLiveResult({ ein: 530196605, totrevenue: '100' })
  assert.ok(wrongType)
  assert.equal(wrongType.revenue, null)
})

test('mapLiveResults fails safely on non-arrays and null/malformed entries', () => {
  assert.deepEqual(mapLiveResults(null), [])
  assert.deepEqual(mapLiveResults(undefined), [])
  assert.deepEqual(mapLiveResults('not-an-array'), [])
  assert.deepEqual(mapLiveResults({ ein: 530196605 }), [])

  const mixed = mapLiveResults([
    null,
    { ein: 0 },
    { ein: 'bad' },
    { ein: 530196605, name: 'Valid Org' },
    'junk',
  ])
  assert.equal(mixed.length, 1)
  assert.equal(mixed[0].ein, 530196605)

  const limited = mapLiveResults(
    [1, 2, 3, 4, 5, 6, 7].map((n) => ({ ein: 10000000 + n })),
    5,
  )
  assert.equal(limited.length, 5)
})

test('lookup financial periods are source-reported or explicitly unknown', () => {
  assert.equal(toLiveResult({ ein: 530196605, tax_prd: 202312 })?.taxPeriod, 202312)
  for (const value of [undefined, null, '202312', 202313, 202300, 202312.5, 0, Infinity]) {
    assert.equal(toLiveResult({ ein: 530196605, tax_prd: value })?.taxPeriod, null)
  }
})

test('safeDocumentUrl allows only HTTPS source PDF URLs', () => {
  const good = 'https://projects.propublica.org/nonprofits/download-filing?path=x.pdf'
  assert.equal(safeDocumentUrl(good), good)

  for (const bad of [
    'http://projects.propublica.org/x.pdf',
    'ftp://projects.propublica.org/x.pdf',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://evil.example.com/x.pdf',
    'https://user:pass@projects.propublica.org/x.pdf',
    'not a url',
    '',
    null,
    undefined,
    42,
  ]) {
    assert.equal(safeDocumentUrl(bad), null, `unsafe URL ${JSON.stringify(bad)}`)
  }
})
