import { LOOKUP_API, lookup, lookupUrl, type LookupPage } from './lookup.ts'

export interface LookupSnapshot {
  data: LookupPage
  fetchedAt: number
  stale: boolean
}

const MAX_ENTRIES = 40
const FRESH_MS = 15 * 60 * 1000
const KEY_VERSION = 'v1'

interface Entry {
  data: LookupPage
  fetchedAt: number
}

/**
 * In-memory cache in front of the validated first-party lookup. Keys are
 * versioned and scope the fixed source endpoint, the exact submitted
 * (trimmed) query and the page — identifiers and name spelling are never
 * canonicalized or repaired. Only successful, already-validated pages are
 * stored; errors are never cached. Expired entries stay bound in the cache
 * so a failed refresh can fall back to them marked stale. No persistence,
 * no logging, no in-flight sharing.
 */
export function createLookupCache(options: { fetcher?: typeof fetch; now?: () => number } = {}) {
  const fetcher = options.fetcher ?? fetch
  const now = options.now ?? (() => Date.now())
  const entries = new Map<string, Entry>()

  function key(query: string, page: number): string {
    // Strict literal validation of EIN/name/page before any cache read or lookup.
    lookupUrl(query, page)
    return `${KEY_VERSION}|${LOOKUP_API}|${query.trim()}|${page}`
  }

  function isFresh(fetchedAt: number): boolean {
    const age = now() - fetchedAt
    // Age past the TTL or a clock rollback both count as stale.
    return age >= 0 && age < FRESH_MS
  }

  function touch(k: string, entry: Entry): void {
    entries.delete(k)
    entries.set(k, entry)
    while (entries.size > MAX_ENTRIES) {
      const oldest = entries.keys().next()
      if (oldest.done) break
      entries.delete(oldest.value)
    }
  }

  function snapshot(entry: Entry): LookupSnapshot {
    // Copy of the metadata; age hits never reset fetchedAt.
    return { data: entry.data, fetchedAt: entry.fetchedAt, stale: !isFresh(entry.fetchedAt) }
  }

  return {
    read(query: string, page: number): LookupSnapshot | null {
      const k = key(query, page)
      const entry = entries.get(k)
      if (!entry) return null
      touch(k, entry)
      return snapshot(entry)
    },

    async load(query: string, page: number, signal: AbortSignal, force = false): Promise<LookupSnapshot> {
      const k = key(query, page)
      signal.throwIfAborted()
      if (!force) {
        const entry = entries.get(k)
        if (entry && isFresh(entry.fetchedAt)) {
          touch(k, entry)
          signal.throwIfAborted()
          return { data: entry.data, fetchedAt: entry.fetchedAt, stale: false }
        }
      }
      // Force bypasses a fresh hit but never clears the old fallback entry;
      // it is only overwritten by a new validated success below.
      const data = await lookup(query, page, signal, fetcher)
      signal.throwIfAborted()
      const entry: Entry = { data, fetchedAt: now() }
      touch(k, entry)
      return { data: entry.data, fetchedAt: entry.fetchedAt, stale: false }
    },

    clear(): void {
      entries.clear()
    },
  }
}

export const lookupCache = createLookupCache()
