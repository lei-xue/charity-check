import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatMoney } from '../src/lib/status.ts'

test('formatMoney compacts to K/M/B/T with one decimal', () => {
  assert.equal(formatMoney(1_200_000), '$1.2M')
  assert.equal(formatMoney(340_000), '$340K')
  assert.equal(formatMoney(123_456), '$123.5K')
  assert.equal(formatMoney(123_000), '$123K')
  assert.equal(formatMoney(5_052_941_623), '$5.1B')
  assert.equal(formatMoney(1_230_000_000_000), '$1.2T')
})

test('formatMoney drops the trailing .0', () => {
  assert.equal(formatMoney(1_000_000), '$1M')
  assert.equal(formatMoney(2_000_000_000), '$2B')
  assert.equal(formatMoney(3_000), '$3K')
})

test('formatMoney keeps small amounts exact', () => {
  assert.equal(formatMoney(999), '$999')
  assert.equal(formatMoney(0), '$0')
  assert.equal(formatMoney(1), '$1')
  assert.equal(formatMoney(1_500), '$1.5K')
})

test('formatMoney handles null, undefined, and non-finite values', () => {
  assert.equal(formatMoney(null), '—')
  assert.equal(formatMoney(undefined), '—')
  assert.equal(formatMoney(Number.NaN), '—')
  assert.equal(formatMoney(Number.POSITIVE_INFINITY), '—')
})

test('formatMoney prefixes negative amounts with a minus sign', () => {
  assert.equal(formatMoney(-1_200_000), '-$1.2M')
  assert.equal(formatMoney(-500), '-$500')
})
