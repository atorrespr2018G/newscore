/** Sentinel value for ellipsis gaps in page number lists. */
export const PAGINATION_ELLIPSIS = 'ellipsis' as const

export type PaginationTokenType = number | typeof PAGINATION_ELLIPSIS

/**
 * Compute total page count from total items and page size.
 *
 * @param total Total item count.
 * @param pageSize Items shown per page.
 * @returns Total page count (minimum 1).
 */
export function totalPagesFor(total: number, pageSize: number): number {
  if (total <= 0) {
    return 1
  }
  return Math.ceil(total / pageSize)
}

/**
 * Build the inclusive item range shown on the current page.
 *
 * @param page Current 1-indexed page.
 * @param pageSize Items shown per page.
 * @param total Total item count.
 * @returns Start and end item indices (1-indexed), or zeros when empty.
 */
export function pageItemRange(
  page: number,
  pageSize: number,
  total: number,
): { start: number; end: number } {
  if (total <= 0) {
    return { start: 0, end: 0 }
  }
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return { start, end }
}

/**
 * Build page number tokens with ellipsis for large page counts.
 *
 * Always includes the first page, last page, and a window around the current
 * page so editors can jump directly without stepping one page at a time.
 *
 * @param currentPage Current 1-indexed page.
 * @param totalPages Total number of pages.
 * @param siblingCount Pages shown on each side of the current page.
 * @returns Ordered page numbers and ellipsis markers.
 */
export function buildPageTokens(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): PaginationTokenType[] {
  if (totalPages <= 0) {
    return []
  }
  if (totalPages === 1) {
    return [1]
  }

  const pageSet = new Set<number>([1, totalPages])
  for (let page = currentPage - siblingCount; page <= currentPage + siblingCount; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pageSet.add(page)
    }
  }

  const sortedPages = Array.from(pageSet).sort((left, right) => left - right)
  const tokens: PaginationTokenType[] = []

  for (let index = 0; index < sortedPages.length; index += 1) {
    tokens.push(sortedPages[index])
    const nextPage = sortedPages[index + 1]
    if (nextPage !== undefined && nextPage - sortedPages[index] > 1) {
      tokens.push(PAGINATION_ELLIPSIS)
    }
  }

  return tokens
}
