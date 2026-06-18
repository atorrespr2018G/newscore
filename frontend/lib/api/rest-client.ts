import {
  ensureDevEditorialSession,
  getStoredToken,
  invalidateStoredSession,
} from '@/lib/api/auth'

/**
 * Typed API error preserving HTTP status.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const RETRYABLE_AUTH_ERRORS = new Set(['Invalid token', 'Missing bearer token'])

/**
 * Build request headers with the current bearer token when available.
 *
 * @param init Optional fetch init.
 * @returns Headers ready for an authenticated request.
 */
function buildAuthHeaders(init: RequestInit = {}): Headers {
  const token = getStoredToken()
  const headers = new Headers(init.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

/**
 * Perform an authenticated JSON fetch request.
 *
 * @param url Request URL.
 * @param init Optional fetch init.
 * @param allowAuthRetry Whether a failed auth response may trigger one re-login retry.
 * @returns Parsed JSON payload.
 * @throws ApiError When the response status is not successful.
 */
export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
  allowAuthRetry = true,
): Promise<T> {
  if (typeof window !== 'undefined') {
    await ensureDevEditorialSession()
  }

  const res = await fetch(url, { ...init, headers: buildAuthHeaders(init) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : `Request failed (${res.status})`

    if (
      allowAuthRetry &&
      typeof window !== 'undefined' &&
      res.status === 403 &&
      RETRYABLE_AUTH_ERRORS.has(detail)
    ) {
      invalidateStoredSession()
      await ensureDevEditorialSession()
      return apiFetch<T>(url, init, false)
    }

    throw new ApiError(detail, res.status)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}
