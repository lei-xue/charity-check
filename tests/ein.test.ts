import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  classifyEinQuery,
  einDigits,
  einMatchesQuery,
  formatEin,
  parseEinInput,
  resolveCuratedRouteIn,
  resolveRouteEin,
} from '../src/lib/status.ts'

interface CuratedRecord {
  ein: number
  name: string
}

// Real dataset, parsed the same way the schema test does — the pure resolver
// is then exercised against actual leading-zero records.
const charities = JSON.parse(
  readFileSync(new URL('../src/data/charities.json', import.meta.url), 'utf8'),
) as CuratedRecord[]

const LEADING_ZERO = charities.find((charity) => String(charity.ein).length < 9)

test('parseEinInput accepts strict 9-digit and XX-XXXXXXX forms', () => {
  const accepted: [string, string][] = [
    ['530196605', '530196605'],
    ['53-0196605', '530196605'],
    [' 530196605 ', '530196605'],
    ['\t53-0196605\n', '530196605'],
    ['042263040', '042263040'],
    ['04-2263040', '042263040'],
  ]
  for (const [input, expected] of accepted) {
    const result = parseEinInput(input)
    assert.equal(result.ok, true, `expected ${JSON.stringify(input)} to parse`)
    if (result.ok) assert.equal(result.ein, expected)
  }
})

test('parseEinInput rejects malformed, embedded, mis-sized and numeric-notation input', () => {
  const rejected = [
    '',
    '   ',
    '12345678', // 8 digits
    '1234567890', // 10 digits
    '53019660', // 8 digits
    '53-019660', // 8 digits after the dash
    '5301966055', // 10 digits, no dash
    '53-01966055', // 10 digits after the dash
    '53-0196-605', // extra separator
    '53 0196605', // embedded space
    '53\t0196605', // embedded tab
    '1234567', // too short, must not be padded
    '1.2e8', // exponent
    '530196605.0', // decimal
    '0x530196605', // hex prefix
    'abc530196605', // embedded letters
    '530196605x', // trailing letters
    '53-0196605 extra', // trailing text
    '53-0196605-', // trailing separator
    '-530196605', // leading separator
    ' 53-0196605\n\n0', // trailing extra digit
    '５３０１９６６０５', // full-width digits
    '000000000', // all-zero
    '00-0000000', // all-zero
  ]
  for (const input of rejected) {
    assert.equal(parseEinInput(input).ok, false, `expected ${JSON.stringify(input)} to be rejected`)
  }
})

test('parseEinInput reports distinct rejection reasons', () => {
  assert.deepEqual(parseEinInput(''), { ok: false, reason: 'empty' })
  assert.deepEqual(parseEinInput('   '), { ok: false, reason: 'empty' })
  assert.deepEqual(parseEinInput('123'), { ok: false, reason: 'format' })
  assert.deepEqual(parseEinInput('000000000'), { ok: false, reason: 'zero' })
  assert.deepEqual(parseEinInput('00-0000000'), { ok: false, reason: 'zero' })
})

test('parseEinInput never silently strips or pads invalid input', () => {
  assert.equal(parseEinInput('53 0196605').ok, false)
  assert.equal(parseEinInput('5301966').ok, false)
  assert.equal(parseEinInput(' 530196605 ').ok, true)
})

test('classifyEinQuery separates EINs, EIN-shaped typos and name queries', () => {
  const valid = classifyEinQuery('53-0196605')
  assert.equal(valid.kind, 'ein')
  assert.equal(valid.ein, '530196605')

  for (const shaped of ['12-34', '990', '000000000', '53 0196605', '12345678']) {
    assert.equal(classifyEinQuery(shaped).kind, 'invalid-ein', `${shaped} is EIN-shaped`)
  }

  // Names that merely contain numbers stay name queries.
  for (const name of ['3M Foundation', 'Wildlife Fund 2', 'Toys for Tots 2024', 'E22']) {
    assert.equal(classifyEinQuery(name).kind, 'text', `${name} is a name query`)
  }

  assert.equal(classifyEinQuery('').kind, 'text')
})

test('einDigits and formatEin pad numeric source identifiers to 9 digits', () => {
  assert.equal(einDigits(530196605), '530196605')
  assert.equal(einDigits(42263040), '042263040')
  assert.equal(formatEin(42263040), '04-2263040')
  assert.equal(formatEin(10471949), '01-0471949')
})

test('einMatchesQuery finds leading-zero records via canonical and raw forms', () => {
  assert.equal(einMatchesQuery(42263040, '04-2263040'), true)
  assert.equal(einMatchesQuery(42263040, '042263040'), true)
  assert.equal(einMatchesQuery(42263040, ' 04-2263040 '), true)
  assert.equal(einMatchesQuery(42263040, '42263040'), true)
})

test('einMatchesQuery never matches arbitrary embedded digits', () => {
  assert.equal(einMatchesQuery(133039601, '3039601'), false)
  assert.equal(einMatchesQuery(133039601, '039601'), false)
  assert.equal(einMatchesQuery(133039601, '1330396010'), false)
  assert.equal(einMatchesQuery(133039601, 'abc133039601'), false)
  assert.equal(einMatchesQuery(133039601, 'Alzheimer'), false)
  assert.equal(einMatchesQuery(530196605, '530196606'), false)
  assert.equal(einMatchesQuery(530196605, '53 0196605'), false)
  assert.equal(einMatchesQuery(123456789, '12-34-56789'), false)
  assert.equal(einMatchesQuery(123456789, '1234567890'), false)
})

test('resolveRouteEin distinguishes canonical, legacy and invalid routes', () => {
  assert.deepEqual(resolveRouteEin('530196605'), { kind: 'canonical', ein: '530196605' })
  assert.deepEqual(resolveRouteEin('04-2263040'), { kind: 'canonical', ein: '042263040' })
  assert.deepEqual(resolveRouteEin('42263040'), { kind: 'legacy', ein: 42263040 })

  for (const param of ['abc530196605', '12-34', '5301966050', '000000000', '0', 'not-an-ein']) {
    assert.deepEqual(resolveRouteEin(param), { kind: 'invalid' }, `${param} should be invalid`)
  }
})

test('resolveCuratedRouteIn reaches leading-zero records and refuses malformed routes', () => {
  assert.ok(LEADING_ZERO, 'expected at least one leading-zero EIN in the curated dataset')
  const leadingZero = LEADING_ZERO as CuratedRecord
  const canonical = formatEin(leadingZero.ein)

  assert.equal(resolveCuratedRouteIn(charities, canonical)?.ein, leadingZero.ein)
  assert.equal(resolveCuratedRouteIn(charities, einDigits(leadingZero.ein))?.ein, leadingZero.ein)
  assert.equal(resolveCuratedRouteIn(charities, String(leadingZero.ein))?.ein, leadingZero.ein)

  // Malformed and embedded routes never resolve, even when real digits appear.
  assert.equal(resolveCuratedRouteIn(charities, `abc${canonical}`), undefined)
  assert.equal(resolveCuratedRouteIn(charities, `12-34`), undefined)
  assert.equal(resolveCuratedRouteIn(charities, formatEin(leadingZero.ein).slice(3)), undefined)
})

test('resolveCuratedRouteIn resolves a normal curated EIN', () => {
  const org = charities.find((charity) => String(charity.ein).length === 9)
  assert.ok(org, 'expected at least one 9-digit EIN in the curated dataset')
  const record = org as CuratedRecord
  assert.equal(resolveCuratedRouteIn(charities, String(record.ein))?.ein, record.ein)
  assert.equal(resolveCuratedRouteIn(charities, formatEin(record.ein))?.ein, record.ein)
})
