import type { IEditorStoryRow } from '@/components/features/editor-story-pool'

/** Page size used when fetching the editor's article pool. */
export const EDITOR_FETCH_PAGE_SIZE = 200

interface IPaginatedArticles {
  items: IEditorStoryRow[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

/**
 * Move an array item to a new index.
 *
 * @param items Source list.
 * @param fromIndex Current index.
 * @param toIndex Target index.
 * @returns Reordered list.
 */
export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

/**
 * Fetch every page from a paginated articles endpoint.
 *
 * @param buildUrl Builds the request URL for a page number.
 * @param fetchPage Performs the request for a single page.
 * @returns Combined article rows across all pages.
 */
export async function fetchAllPaginatedArticles(
  buildUrl: (page: number) => string,
  fetchPage: (url: string) => Promise<IPaginatedArticles>,
): Promise<IEditorStoryRow[]> {
  const items: IEditorStoryRow[] = []
  let page = 1

  while (true) {
    const data = await fetchPage(buildUrl(page))
    items.push(...data.items)
    if (!data.has_more) {
      break
    }
    page += 1
  }

  return items
}
