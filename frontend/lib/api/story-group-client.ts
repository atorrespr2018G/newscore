import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'

/** A distinct editor-assigned story group with its article count. */
export interface IStoryGroupOut {
  id: string
  articleCount: number
  sampleTitle: string
}

/** Raw story group payload as returned by the news REST API. */
interface IStoryGroupResponse {
  id: string
  article_count: number
  sample_title: string
}

/**
 * Fetch the distinct story groups editors can assign articles to.
 *
 * @returns Story groups ordered by article count, largest first.
 * @throws ApiError When the request fails.
 */
export async function getStoryGroups(): Promise<IStoryGroupOut[]> {
  const groups = await apiFetch<IStoryGroupResponse[]>(`${apiConfig.news}/articles/story-groups`)
  return groups.map((group) => ({
    id: group.id,
    articleCount: group.article_count,
    sampleTitle: group.sample_title,
  }))
}
