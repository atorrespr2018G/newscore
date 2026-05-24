import { apiConfig } from '@/lib/api/config'

const TOKEN_KEY = 'newscore_admin_token'

export interface ILoginResult {
  accessToken: string
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

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
