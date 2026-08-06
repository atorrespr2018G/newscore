/** Typed HTTP client for the independent media-editor API. */

export type MediaType = 'image' | 'video'
export type StoryStatus = 'draft' | 'ready'

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
  owner_id: string
  created_at: string
  updated_at: string
}

interface IMediaListResponse {
  items: IMediaAsset[]
}

const apiUrl = process.env.NEXT_PUBLIC_MEDIA_EDITOR_API_URL ?? 'http://localhost:5004/api/v1/media-editor'

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
    throw new Error(body?.detail ?? 'Media editor request failed')
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

/** Sign in with the existing NewsCore authentication API. */
export async function login(email: string, password: string): Promise<void> {
  const authUrl = process.env.NEXT_PUBLIC_NEWSCORE_AUTH_URL ?? 'http://localhost:5001'
  const response = await fetch(`${authUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
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

/** Render a basic video derivative through the backend FFmpeg worker. */
export async function renderVideo(
  id: string,
  instruction: {
    trim_start_seconds: number
    trim_end_seconds?: number
    title?: string
    lower_third?: string
    logo_url?: string
  },
): Promise<IMediaAsset> {
  return request<IMediaAsset>(`/assets/${id}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instruction),
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
    }),
  })
}
