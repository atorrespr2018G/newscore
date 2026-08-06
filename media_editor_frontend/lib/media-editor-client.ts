/** Typed HTTP client for the independent media-editor API. */

export type MediaType = 'image' | 'video'

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

export interface IMediaCollection {
  id: string
  title: string
  description: string | null
  asset_ids: string[]
  status: 'draft' | 'ready'
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

/** Upload a source image or video file. */
export async function uploadAsset(file: File): Promise<IMediaAsset> {
  const body = new FormData()
  body.append('file', file)
  return request<IMediaAsset>('/assets', { method: 'POST', body })
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

/** List the authenticated reporter's ordered media collections. */
export async function listCollections(): Promise<IMediaCollection[]> {
  return request<IMediaCollection[]>('/collections')
}

/** Create a reporter-owned draft collection. */
export async function createCollection(title: string): Promise<IMediaCollection> {
  return request<IMediaCollection>('/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, asset_ids: [] }),
  })
}

/** Persist a collection's ordered media selection and readiness status. */
export async function updateCollection(
  collection: IMediaCollection,
  assetIds: string[],
  status: IMediaCollection['status'],
): Promise<IMediaCollection> {
  return request<IMediaCollection>(`/collections/${collection.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: collection.title,
      description: collection.description,
      asset_ids: assetIds,
      status,
    }),
  })
}
