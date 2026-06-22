import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'

/** Minimal article fields returned by the editorial workflow transitions. */
export interface IArticleWorkflowResult {
  id: string
  title: string
  status: string
}

/**
 * Submit a draft article into the editorial review queue.
 *
 * @param articleId Article id to submit for review.
 * @returns The updated article in `review` status.
 * @throws ApiError When the transition is rejected or the request fails.
 */
export async function submitArticleForReview(articleId: string): Promise<IArticleWorkflowResult> {
  return apiFetch<IArticleWorkflowResult>(
    `${apiConfig.news}/articles/${articleId}/submit-for-review`,
    { method: 'POST' },
  )
}

/**
 * Approve an in-review article, publishing it.
 *
 * @param articleId Article id to approve.
 * @returns The updated article in `published` status.
 * @throws ApiError When the transition is rejected or the request fails.
 */
export async function approveArticle(articleId: string): Promise<IArticleWorkflowResult> {
  return apiFetch<IArticleWorkflowResult>(`${apiConfig.news}/articles/${articleId}/approve`, {
    method: 'POST',
  })
}

/**
 * Send an in-review article back to draft for further edits.
 *
 * @param articleId Article id to send back.
 * @returns The updated article in `draft` status.
 * @throws ApiError When the transition is rejected or the request fails.
 */
export async function sendArticleBack(articleId: string): Promise<IArticleWorkflowResult> {
  return apiFetch<IArticleWorkflowResult>(`${apiConfig.news}/articles/${articleId}/send-back`, {
    method: 'POST',
  })
}
