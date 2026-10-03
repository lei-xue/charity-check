/** Page size for the local browse grid. */
export const BROWSE_PAGE_SIZE = 12

/** Number of pages needed for `total` items (0 when there is nothing to show). */
export function pageCount(total: number, size = BROWSE_PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.ceil(total / size)
}

/** Clamp a 1-based page request into the valid range for `total` items. */
export function clampPage(page: number, total: number, size = BROWSE_PAGE_SIZE): number {
  const pages = pageCount(total, size)
  if (pages === 0) return 1
  if (!Number.isFinite(page) || page < 1) return 1
  if (page > pages) return pages
  return Math.trunc(page)
}

/** Items for a 1-based page; the page is clamped so out-of-range requests never drop data. */
export function pageItems<T>(items: readonly T[], page: number, size = BROWSE_PAGE_SIZE): T[] {
  const current = clampPage(page, items.length, size)
  return items.slice((current - 1) * size, current * size)
}

/** 1-based inclusive [start, end] range of a page, or null when the page is empty. */
export function pageRange(total: number, page: number, size = BROWSE_PAGE_SIZE): [number, number] | null {
  if (pageCount(total, size) === 0) return null
  const current = clampPage(page, total, size)
  const start = (current - 1) * size + 1
  return [start, Math.min(current * size, total)]
}
