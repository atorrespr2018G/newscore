import { apiConfig } from '@/lib/api/config'
import { decodeJwtPayload } from '@/lib/helpers/jwt'

const TOKEN_KEY = 'newscore_admin_token'
const TOKEN_EXPIRY_BUFFER_SECONDS = 30

const DEV_EDITORIAL_EMAIL = 'admin@newscore.local'
const DEV_EDITORIAL_PASSWORD = 'admin123!'

let devSessionPromise: Promise<void> | null = null

export interface ILoginResult {
  accessToken: string
}

/**
 * Read the persisted admin token from local storage.
 *
 * @returns Stored token or null when unavailable.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

/**
 * Persist the admin access token in local storage.
 *
 * @param token Access token value.
 */
export function storeToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Remove the persisted admin token.
 */
export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

/**
 * Clear persisted auth state so the next session bootstrap can re-login.
 */
export function invalidateStoredSession(): void {
  clearToken()
  devSessionPromise = null
}

/**
 * Determine whether the stored JWT is present and not expired.
 *
 * @returns True when a usable bearer token is available.
 */
export function isStoredTokenUsable(): boolean {
  const token = getStoredToken()
  if (!token) {
    return false
  }
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) {
    return false
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  return payload.exp > nowSeconds + TOKEN_EXPIRY_BUFFER_SECONDS
}

/**
 * Read authenticated user's preferred UI locale when available.
 *
 * @returns Preferred locale or null when unavailable.
 */
export async function getProfileLocalePreference(): Promise<string | null> {
  // Seam for future profile API: return user.language when endpoint exists.
  return null
}

/**
 * Persist authenticated user's preferred UI locale.
 *
 * @param locale Locale code to persist.
 * @returns Resolves when persistence succeeds.
 */
export async function updateProfileLocale(locale: string): Promise<void> {
  // Seam for future profile API: PATCH /users/me { language: locale }.
  void locale
}

/**
 * Authenticate against the admin API and persist the resulting token.
 *
 * @param email Admin account email.
 * @param password Admin account password.
 * @returns Access token payload.
 * @throws Error When authentication fails.
 */
export async function login(email: string, password: string): Promise<ILoginResult> {
  const res = await fetch(`${apiConfig.admin}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : 'Login failed'
    throw new Error(detail)
  }
  const data = (await res.json()) as { access_token: string }
  storeToken(data.access_token)
  return { accessToken: data.access_token }
}

/**
 * Ensure a dev editorial API token exists without showing a login screen.
 *
 * @returns Resolves when a token is stored or already present.
 */
export async function ensureDevEditorialSession(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }
  if (isStoredTokenUsable()) {
    return
  }
  if (getStoredToken()) {
    invalidateStoredSession()
  }
  if (!devSessionPromise) {
    devSessionPromise = login(DEV_EDITORIAL_EMAIL, DEV_EDITORIAL_PASSWORD)
      .then(() => undefined)
      .catch((error: unknown) => {
        devSessionPromise = null
        throw error
      })
  }
  await devSessionPromise
}
