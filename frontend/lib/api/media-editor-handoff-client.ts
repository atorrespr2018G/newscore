import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'

/** One Media Desk asset included in a ready report package. */
export interface IMediaDeskAsset {
  id: string
  file_type: 'image' | 'video' | 'audio'
  url: string
  preview_url: string | null
  original_filename: string
  title: string | null
  version_of: string | null
  width: number | null
  height: number | null
  duration: number | null
}

/** Ready story metadata from the Media Desk handoff API. */
export interface IMediaDeskStory {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'ready'
  selected_asset_ids: string[]
  updated_at: string
}

/** Ready package: story plus independently selectable report assets. */
export interface IMediaDeskHandoffPackage {
  story: IMediaDeskStory
  assets: IMediaDeskAsset[]
}

/**
 * List ready Media Desk packages owned by the current reporter.
 *
 * @returns Packages with report assets in transfer order.
 */
export function listMediaDeskHandoffs(): Promise<IMediaDeskHandoffPackage[]> {
  return apiFetch<IMediaDeskHandoffPackage[]>(`${apiConfig.mediaEditor}/handoff/packages`)
}
