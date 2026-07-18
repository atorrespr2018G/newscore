import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'

export interface IRegionOut {
  id: string
  code: string
  name: string
  kind: string
  parent_id: string | null
  ancestor_ids: string[]
  depth: number
  path: string
  country_code: string | null
  is_active: boolean
  default_locale: string | null
  labels: Record<string, string>
  created_at: string
  updated_at: string
}

/**
 * Fetch one region by id from the admin API.
 *
 * @param regionId Region document id.
 * @returns Region detail with canonical code.
 */
export async function getRegionById(regionId: string): Promise<IRegionOut> {
  return apiFetch<IRegionOut>(`${apiConfig.admin}/regions/${regionId}`)
}
