/** Supported admin JWT role claims. */
export type AdminRoleType = 'admin' | 'editor' | 'reporter' | 'viewer'

/** Decoded JWT payload fields used by the admin UI. */
export interface IJwtPayload {
  sub: string
  role: AdminRoleType
  exp: number
}

/**
 * Decode a JWT payload without verifying the signature (client-side routing only).
 *
 * @param token Raw JWT string.
 * @returns Parsed payload or null when decoding fails.
 */
export function decodeJwtPayload(token: string): IJwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(normalized)
    return JSON.parse(json) as IJwtPayload
  } catch {
    return null
  }
}
