/** Typed HTTP client for the independent media-editor API. */

export type MediaType = 'image' | 'video' | 'audio'
export type StoryStatus = 'draft' | 'ready'
export type MarketCode = 'us' | 'pr' | 'co'

export interface IMediaAsset {
  id: string
  file_type: MediaType
  url: string
  preview_url: string | null
  original_filename: string
  uploader_id: string
  processing_status: 'ready' | 'processing' | 'failed'
  width: number | null
  height: number | null
  duration: number | null
  version_of: string | null
  title: string | null
  description: string | null
  alt_text: string | null
  credit: string | null
  tags: string[]
  created_at: string
}

/** One news story with an originals pool and an ordered report selection. */
export interface IMediaStory {
  id: string
  title: string
  description: string | null
  pool_asset_ids: string[]
  selected_asset_ids: string[]
  status: StoryStatus
  market_code: MarketCode
  town_id: string | null
  county_id: string | null
  category_slugs: string[]
  international_potential: number | null
  owner_id: string
  created_at: string
  updated_at: string
}

interface IMediaListResponse {
  items: IMediaAsset[]
}

const apiUrl = process.env.NEXT_PUBLIC_MEDIA_EDITOR_API_URL ?? 'http://localhost:5004/api/v1/media-editor'

/**
 * Normalize FastAPI error payloads into a single message string.
 * @param body - Parsed JSON error body, if any.
 * @returns Human-readable detail or null.
 */
function readErrorDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === 'object' && item && 'msg' in item ? String((item as { msg: unknown }).msg) : String(item)))
      .join('; ')
  }
  if (detail != null) return String(detail)
  return null
}

/** Read the origin-local access token for API authorization. */
export function getAccessToken(): string | null {
  return window.localStorage.getItem('media_editor_access_token')
}

/** Persist an access token for the current independent application origin. */
export function setAccessToken(token: string): void {
  window.localStorage.setItem('media_editor_access_token', token)
}

/** Remove the independent application's persisted session token. */
export function clearAccessToken(): void {
  window.localStorage.removeItem('media_editor_access_token')
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: token ? `Bearer ${token}` : '' },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401) {
      clearAccessToken()
      throw new Error('Session expired — sign in again')
    }
    throw new Error(readErrorDetail(body) ?? 'Media editor request failed')
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

/** Sign in with the existing NewsCore authentication API. */
export async function login(email: string, password: string): Promise<void> {
  const authUrl = process.env.NEXT_PUBLIC_NEWSCORE_AUTH_URL ?? 'http://localhost:5001'
  let response: Response
  try {
    response = await fetch(`${authUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error(
      `Cannot reach NewsCore auth at ${authUrl}. Start admin_app (port 5001), then retry.`,
    )
  }
  if (!response.ok) throw new Error('NewsCore sign-in failed')
  const body = (await response.json()) as { access_token: string }
  setAccessToken(body.access_token)
}

/** List the authenticated reporter's media library. */
export async function listAssets(fileType?: MediaType): Promise<IMediaAsset[]> {
  const query = fileType ? `?file_type=${fileType}` : ''
  const response = await request<IMediaListResponse>(`/assets${query}`)
  return response.items
}

/** Upload a source image or video file, optionally into a story originals pool. */
export async function uploadAsset(file: File, storyId?: string): Promise<IMediaAsset> {
  const body = new FormData()
  body.append('file', file)
  const query = storyId ? `?story_id=${encodeURIComponent(storyId)}` : ''
  return request<IMediaAsset>(`/assets${query}`, { method: 'POST', body })
}

/** Persist an asset's editable newsroom metadata. */
export async function updateAsset(id: string, values: Partial<IMediaAsset>): Promise<IMediaAsset> {
  return request<IMediaAsset>(`/assets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
}

/** Delete an owned original or edited media asset. */
export async function deleteAsset(id: string): Promise<void> {
  await request<void>(`/assets/${id}`, { method: 'DELETE' })
}

/** Create a transparent derivative from an image asset. */
export async function removeBackground(id: string): Promise<IMediaAsset> {
  return request<IMediaAsset>(`/assets/${id}/remove-background`, { method: 'POST' })
}

/** List the original upload and every edited version for one picture family. */
export async function listAssetVersions(id: string): Promise<{ root_id: string; items: IMediaAsset[] }> {
  return request<{ root_id: string; items: IMediaAsset[] }>(`/assets/${id}/versions`)
}

/** Save an image-editor export as an immutable derivative asset. */
export async function saveImageDerivative(id: string, file: File): Promise<IMediaAsset> {
  const body = new FormData()
  body.append('file', file)
  return request<IMediaAsset>(`/assets/${id}/derivatives/image`, { method: 'POST', body })
}

/** One included time range for multi-segment video render. */
export interface IVideoSegment {
  start_seconds: number
  end_seconds: number
}

/** Render instruction for segment trim, overlays, and audio mute/replace. */
export interface IVideoRenderInstruction {
  segments: IVideoSegment[]
  title?: string
  lower_third?: string
  logo_url?: string
  mute_audio?: boolean
  replace_audio_asset_id?: string
}

/** Render a shorter MP4 from ordered segments through the backend FFmpeg path. */
export async function renderVideo(
  id: string,
  instruction: IVideoRenderInstruction,
): Promise<IMediaAsset> {
  return request<IMediaAsset>(`/assets/${id}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instruction),
  })
}

/**
 * Merge independently edited videos into one MP4, preserving asset order.
 * @param assetIds - Owned video asset ids in the desired output order.
 * @returns Newly created merged video asset.
 */
export async function mergeVideos(assetIds: string[]): Promise<IMediaAsset> {
  return request<IMediaAsset>('/assets/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_ids: assetIds }),
  })
}

/** List the authenticated reporter's story media packages. */
export async function listStories(): Promise<IMediaStory[]> {
  return request<IMediaStory[]>('/stories')
}

/** Create a draft story package for one news report. */
export async function createStory(title: string, description?: string): Promise<IMediaStory> {
  return request<IMediaStory>('/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description: description || null }),
  })
}

/** Persist story metadata, originals pool, report order, and readiness. */
export async function updateStory(story: IMediaStory): Promise<IMediaStory> {
  return request<IMediaStory>(`/stories/${story.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: story.title,
      description: story.description,
      pool_asset_ids: story.pool_asset_ids,
      selected_asset_ids: story.selected_asset_ids,
      status: story.status,
      market_code: story.market_code,
      town_id: story.town_id,
      county_id: story.county_id,
      category_slugs: story.category_slugs,
      international_potential: story.international_potential,
    }),
  })
}

/** Result of storing a Media Desk package as a NewsCore editor draft. */
export interface ISendToEditorResult {
  article_id: string
  article_title: string
  article_status: string
  media_count: number
}

/**
 * Send selected report assets to NewsCore as a new editor draft article.
 * @param storyId - Media Desk story package id.
 * @param assetIds - Ordered subset of report assets to include.
 * @returns Created NewsCore article summary.
 */
export function sendStoryToEditor(
  storyId: string,
  assetIds: string[],
): Promise<ISendToEditorResult> {
  return request<ISendToEditorResult>(`/handoff/stories/${storyId}/send-to-editor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_ids: assetIds }),
  })
}

/**
 * Fill taxonomy defaults for stories created before placement fields existed.
 * @param story - Raw story payload from the API.
 * @returns Story with reporter-parity taxonomy fields present.
 */
export function normalizeStoryTaxonomy(story: IMediaStory): IMediaStory {
  return {
    ...story,
    market_code: story.market_code ?? 'us',
    town_id: story.town_id ?? null,
    county_id: story.county_id ?? null,
    category_slugs: Array.isArray(story.category_slugs) ? story.category_slugs : [],
    international_potential: story.international_potential ?? null,
  }
}
