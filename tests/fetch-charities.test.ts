import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cachedEntryOutcome,
  deduplicateCharities,
  isCompleteSnapshot,
} from '../scripts/fetch-charities-core.mjs'

const entry = {
  ein: 123456789,
  expectedName: 'Example Foundation',
  expectedSubsectionCode: 3,
  expectedStatusCode: 1,
}
const cached = {
  charity: { ein: 123456789, name: 'Example Foundation', subsectionCode: 3 },
  statusCode: 1,
}

test('fetch cache accepts only records matching pinned name and source expectations', () => {
  assert.deepEqual(cachedEntryOutcome(entry, cached), { kind: 'cached', charity: cached.charity })
  assert.equal(cachedEntryOutcome({ ...entry, expectedName: 'Wrong Name' }, cached).kind, 'fetch')
  assert.equal(cachedEntryOutcome({ ...entry, expectedSubsectionCode: 4 }, cached).kind, 'fetch')
  assert.equal(cachedEntryOutcome({ ...entry, expectedStatusCode: 2 }, cached).kind, 'fetch')
})

test('cached zero-result entries can be retried without invalidating successful cache hits', () => {
  const miss = { miss: true, note: 'no results' }
  assert.deepEqual(cachedEntryOutcome(entry, miss), { kind: 'miss', note: 'no results' })
  assert.deepEqual(cachedEntryOutcome(entry, miss, { retryMisses: true }), { kind: 'fetch' })
  assert.deepEqual(cachedEntryOutcome(entry, cached, { retryMisses: true }), { kind: 'cached', charity: cached.charity })
})

test('deduplication preserves the first record and reports repeated EINs', () => {
  const first = { ein: 1, name: 'First' }
  const { charities, duplicateEins } = deduplicateCharities([first, { ein: 2 }, { ein: 1, name: 'Duplicate' }])
  assert.deepEqual(charities, [first, { ein: 2 }])
  assert.deepEqual(duplicateEins, [1])
})

test('snapshot gate refuses failures, misses, duplicates, and incomplete totals', () => {
  const complete = { charities: [{ ein: 1 }, { ein: 2 }], expectedCount: 2, failed: 0, noResults: 0, duplicateEins: [] }
  assert.equal(isCompleteSnapshot(complete), true)
  assert.equal(isCompleteSnapshot({ ...complete, failed: 1 }), false)
  assert.equal(isCompleteSnapshot({ ...complete, noResults: 1 }), false)
  assert.equal(isCompleteSnapshot({ ...complete, duplicateEins: [2] }), false)
  assert.equal(isCompleteSnapshot({ ...complete, charities: [{ ein: 1 }] }), false)
})
