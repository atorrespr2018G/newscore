import type { IEditorStoryRow } from '@/components/features/editor-story-pool'
import type { IArticlePlacement } from '@/lib/helpers/article-placements'

/** Page size used when fetching the editor's article pool. */
export const EDITOR_FETCH_PAGE_SIZE = 200

/** Lifecycle status assigned to articles uploaded through the Reporter tool. */
export const REPORTER_UPLOAD_STATUS = 'draft'

/**
 * Decide whether an article is freshly uploaded news awaiting curation.
 *
 * Reporter uploads land as drafts and are treated as "new" only until an
 * editor places them on a page. Once a placement exists (even a staged one),
 * the story has joined the curated pool and is no longer considered new.
 *
 * @param article Editor story row to classify.
 * @param placements Resolved placements for the article (empty when unplaced).
 * @returns True when the article is a new, unplaced reporter upload.
 */
export function isNewReporterArticle(
  article: IEditorStoryRow,
  placements: IArticlePlacement[],
): boolean {
  return article.status === REPORTER_UPLOAD_STATUS && placements.length === 0
}

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
