import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import { EDITOR_FETCH_PAGE_SIZE, fetchAllPaginatedArticles } from '@/lib/helpers/editor-curation'

/** Lifecycle status for stories awaiting editorial approval. */
export const REVIEW_STATUS = 'review'

/** Subset of article fields rendered in the review queue. */
export interface IReviewArticle {
  id: string
  title: string
  author_name: string
}

/**
 * Fetch every article currently awaiting review.
 *
 * @returns Review-status articles reduced to their display fields.
 * @throws ApiError When the articles request fails.
 */
export async function fetchReviewArticles(): Promise<IReviewArticle[]> {
  const rows = await fetchAllPaginatedArticles(
    (page) =>
      `${apiConfig.news}/articles?${new URLSearchParams({
        page: String(page),
        page_size: String(EDITOR_FETCH_PAGE_SIZE),
      }).toString()}`,
    (url) => apiFetch(url),
  )
  return rows
    .filter((row) => row.status === REVIEW_STATUS)
    .map((row) => ({ id: row.id, title: row.title, author_name: row.author_name }))
}
