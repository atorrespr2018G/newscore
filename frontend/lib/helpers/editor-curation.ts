import type { IEditorStoryRow } from '@/interfaces/editor-article'
import type { IArticlePlacement } from '@/lib/helpers/article-placements'

/** Page size used when fetching search results for the editor pool. */
export const EDITOR_FETCH_PAGE_SIZE = 200

/**
 * Multi-field search/filter criteria for the editor story pool.
 *
 * Fields combine with AND on the backend. A non-empty `newsId` is an exact
 * article-id lookup that overrides every other field and matches all statuses.
 *
 * Location fields (`marketCode` / `townId` / `countyId`) mirror the Placement
 * scope switcher UI but live only in this filter object — they never write to
 * the Placement `EditorScope` store.
 */
export interface IEditorSearchFilters {
  title: string
  categoryId: string
  createdFrom: string
  createdTo: string
  newsId: string
  marketCode: string
  townId: string
  countyId: string
}

/** An empty filter set, used to reset the pool's filter bar. */
export const EMPTY_EDITOR_SEARCH_FILTERS: IEditorSearchFilters = {
  title: '',
  categoryId: '',
  createdFrom: '',
  createdTo: '',
  newsId: '',
  marketCode: '',
  townId: '',
  countyId: '',
}

/**
 * Determine whether any search filter is set (and therefore a search runs).
 *
 * @param filters Current filter-bar values.
 * @returns True when at least one filter has a non-empty trimmed value.
 */
export function hasActiveSearchFilters(filters: IEditorSearchFilters): boolean {
  return (
    filters.title.trim() !== '' ||
    filters.categoryId.trim() !== '' ||
    filters.createdFrom.trim() !== '' ||
    filters.createdTo.trim() !== '' ||
    filters.newsId.trim() !== '' ||
    filters.marketCode.trim() !== '' ||
    filters.townId.trim() !== '' ||
    filters.countyId.trim() !== ''
  )
}

/**
 * Page size used when lazily loading the editor's article pool.
 *
 * Kept small so the pool grows in bounded increments on demand instead of
 * pulling the entire archive into memory on mount.
 */
export const EDITOR_POOL_PAGE_SIZE = 24

/** Lifecycle status assigned to articles uploaded through the Reporter tool. */
export const REPORTER_UPLOAD_STATUS = 'draft'

/** Maximum allowed length for an article headline (mirrors the API schema). */
export const MAX_TITLE_LENGTH = 200

/** Minimum allowed length for an article headline (mirrors the API schema). */
export const MIN_TITLE_LENGTH = 3

/** Minimum number of body text characters required to save an article. */
export const MIN_BODY_TEXT_LENGTH = 10

/**
 * Count the trimmed plain-text characters inside a rich-text HTML string.
 *
 * The rich-text editor emits HTML, but length validation must ignore markup so
 * an "empty" document (e.g. `<p></p>`) does not pass as non-empty body text.
 *
 * @param html Rich-text editor HTML output.
 * @returns Number of non-whitespace-trimmed text characters in the document.
 */
export function htmlTextLength(html: string): number {
  // Fall back to a regex strip during SSR where the DOM is unavailable.
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, '').trim().length
  }
  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent ?? '').trim().length
}

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

export interface IPaginatedArticles {
  items: IEditorStoryRow[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

/**
 * Merge a freshly loaded page into an existing pool, dropping duplicate ids.
 *
 * Lazy pagination can overlap with newly published rows shifting between
 * pages, so de-duplicating by id keeps the rendered pool stable.
 *
 * @param current Already loaded rows.
 * @param incoming Newly fetched page of rows.
 * @returns Combined rows with the first occurrence of each id preserved.
 */
export function mergeArticlePages(
  current: IEditorStoryRow[],
  incoming: IEditorStoryRow[],
): IEditorStoryRow[] {
  const seen = new Set(current.map((row) => row.id))
  const merged = [...current]
  for (const row of incoming) {
    if (!seen.has(row.id)) {
      seen.add(row.id)
      merged.push(row)
    }
  }
  return merged
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
