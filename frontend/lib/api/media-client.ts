import { apiConfig } from '@/lib/api/config'
import { ensureDevEditorialSession, getStoredToken, invalidateStoredSession } from '@/lib/api/auth'
import { ApiError, apiFetch } from '@/lib/api/rest-client'

/** Media asset returned by the news storage API. */
export interface IMediaOut {
  id: string
  file_type: 'image' | 'video'
  url: string
  width: number | null
  height: number | null
  duration: number | null
  uploader_id: string
  created_at: string
}

/**
 * Upload a multipart file to an authenticated media endpoint.
 *
 * @param path API path such as `/media/image`.
 * @param file File payload.
 * @returns Parsed media response.
 * @throws ApiError When upload fails.
 */
async function uploadMediaFile(path: string, file: File, allowAuthRetry = true): Promise<IMediaOut> {
  if (typeof window !== 'undefined') {
    await ensureDevEditorialSession()
  }

  const token = getStoredToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${apiConfig.news}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : `Upload failed (${res.status})`

    if (
      allowAuthRetry &&
      typeof window !== 'undefined' &&
      res.status === 403 &&
      (detail === 'Invalid token' || detail === 'Missing bearer token')
    ) {
      invalidateStoredSession()
      await ensureDevEditorialSession()
      return uploadMediaFile(path, file, false)
    }

    throw new ApiError(detail, res.status)
  }

  return (await res.json()) as IMediaOut
}

/**
 * Upload an image file.
 *
 * @param file Image file selected by the reporter/editor.
 * @returns Created media asset metadata.
 */
export function uploadImage(file: File): Promise<IMediaOut> {
  return uploadMediaFile('/media/image', file)
}

/**
 * Upload a video file.
 *
 * @param file Video file selected by the reporter/editor.
 * @returns Created media asset metadata.
 */
export function uploadVideo(file: File): Promise<IMediaOut> {
  return uploadMediaFile('/media/video', file)
}

/**
 * Load a media asset by id.
 *
 * @param mediaId Media id to fetch.
 * @returns Media asset metadata.
 */
export async function getMediaById(mediaId: string): Promise<IMediaOut> {
  return apiFetch<IMediaOut>(`${apiConfig.news}/media/${mediaId}`)
}
