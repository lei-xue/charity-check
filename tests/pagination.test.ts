import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { BROWSE_PAGE_SIZE, clampPage, pageCount, pageItems, pageRange } from '../src/lib/pagination.ts'
import type { Charity } from '../src/lib/types.ts'

// Read the raw snapshot like schema.test.ts: Node's runner cannot import the
// app's JSON module (vite-only resolution), and the dataset must stay unmodified.
const charities = JSON.parse(
  readFileSync(new URL('../src/data/charities.json', import.meta.url), 'utf8'),
) as Charity[]

test('the ordered union of every page is exactly the 500 source records', () => {
  assert.equal(charities.length, 500)
  const pages = pageCount(charities.length)
  const merged = Array.from({ length: pages }, (_, index) => pageItems(charities, index + 1)).flat()
  assert.equal(merged.length, charities.length)
  assert.deepEqual(merged.map((org) => org.ein), charities.map((org) => org.ein))
})

test('page size and last page match the dataset', () => {
  assert.equal(pageCount(500), Math.ceil(500 / BROWSE_PAGE_SIZE))
  const last = pageItems(charities, pageCount(500))
  assert.equal(last.length, 500 - (pageCount(500) - 1) * BROWSE_PAGE_SIZE)
  assert.ok(last.length > 0 && last.length <= BROWSE_PAGE_SIZE)
  assert.deepEqual(last[0], charities[(pageCount(500) - 1) * BROWSE_PAGE_SIZE])
})

test('out-of-range pages are clamped, never dropping records', () => {
  assert.deepEqual(pageItems(charities, 0), pageItems(charities, 1))
  assert.deepEqual(pageItems(charities, -4), pageItems(charities, 1))
  assert.deepEqual(pageItems(charities, Number.NaN), pageItems(charities, 1))
  assert.deepEqual(pageItems(charities, 9999), pageItems(charities, pageCount(500)))
  assert.equal(clampPage(2, 0), 1)
})

test('ranges are accurate and empty filters produce no bogus range', () => {
  assert.deepEqual(pageRange(500, 1), [1, BROWSE_PAGE_SIZE])
  assert.deepEqual(pageRange(500, 2), [BROWSE_PAGE_SIZE + 1, BROWSE_PAGE_SIZE * 2])
  assert.deepEqual(pageRange(500, pageCount(500)), [(pageCount(500) - 1) * BROWSE_PAGE_SIZE + 1, 500])
  assert.deepEqual(pageRange(0, 1), null)
  assert.deepEqual(pageRange(3, 1), [1, 3])
  assert.equal(pageCount(0), 0)
})
