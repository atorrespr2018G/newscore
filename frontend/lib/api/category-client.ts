import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'

/** Category option returned by the public categories endpoint. */
export interface ICategoryOut {
  id: string
  name: string
  slug: string
}

/**
 * Fetch the list of selectable article categories.
 *
 * @returns All categories available for tagging articles.
 * @throws ApiError When the request fails.
 */
export async function getCategories(): Promise<ICategoryOut[]> {
  return apiFetch<ICategoryOut[]>(`${apiConfig.news}/categories`)
}
