export function cachedEntryOutcome(entry, cachedEntry, { retryMisses = false } = {}) {
  const charity = cachedEntry?.charity
  const expectationsMatch = charity &&
    (entry.expectedName === undefined || charity.name === entry.expectedName) &&
    (entry.expectedSubsectionCode === undefined || charity.subsectionCode === entry.expectedSubsectionCode) &&
    (entry.expectedStatusCode === undefined || cachedEntry.statusCode === entry.expectedStatusCode)

  if (expectationsMatch) return { kind: 'cached', charity }
  if (cachedEntry?.miss && !retryMisses) return { kind: 'miss', note: cachedEntry.note }
  return { kind: 'fetch' }
}

export function deduplicateCharities(charities) {
  const unique = []
  const seenEins = new Set()
  const duplicateEins = []
  for (const charity of charities) {
    if (seenEins.has(charity.ein)) {
      duplicateEins.push(charity.ein)
      continue
    }
    seenEins.add(charity.ein)
    unique.push(charity)
  }
  return { charities: unique, duplicateEins }
}

export function isCompleteSnapshot({ charities, expectedCount, failed, noResults, duplicateEins }) {
  return failed === 0 && noResults === 0 && duplicateEins.length === 0 && charities.length === expectedCount
}
