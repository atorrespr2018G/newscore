import { listCustomTabs } from '@/lib/api/layout-client'

/**
 * Built-in public path segments that are not market-scoped custom tabs.
 * Keep aligned with backend `RESERVED_CUSTOM_TAB_SLUGS` site routes.
 */
const BUILTIN_SITE_SEGMENTS = new Set([
  'admin',
  'api',
  'article',
  'articles',
  'business',
  'entertainment',
  'government',
  'health',
  'login',
  'logout',
  'news',
  'politics',
  'preview',
  'reporter',
  'sports',
  'technology',
  'world',
])

/**
 * First non-empty path segment of a public site pathname.
 *
 * @param pathname Browser pathname such as `/test` or `/test/topic`.
 * @returns Lowercase segment, or null on homepage.
 */
export function firstPathSegment(pathname: string): string | null {
  const cleaned = pathname.split('?')[0]?.split('#')[0] ?? pathname
  const segment = cleaned.replace(/^\/+/, '').split('/')[0]?.trim().toLowerCase()
  return segment || null
}

/**
 * Whether the pathname is a custom-tab route (landing or topic archive).
 *
 * @param pathname Browser pathname.
 * @returns True when the first segment is not a built-in site page.
 */
export function isPossibleCustomTabPath(pathname: string): boolean {
  const segment = firstPathSegment(pathname)
  if (!segment) {
    return false
  }
  return !BUILTIN_SITE_SEGMENTS.has(segment)
}

/**
 * Resolve where to navigate after a market change on a custom-tab URL.
 *
 * When the current path is a custom tab that does not exist for the next
 * market, return `/` so the user is not left on the generic article 404 page.
 *
 * @param pathname Current browser pathname.
 * @param marketCode Market being switched to.
 * @returns Homepage href when the tab is unavailable; otherwise null (stay).
 */
export async function hrefAfterMarketChange(
  pathname: string,
  marketCode: string,
): Promise<string | null> {
  if (!isPossibleCustomTabPath(pathname)) {
    return null
  }
  const segment = firstPathSegment(pathname)
  if (!segment) {
    return null
  }
  const tabs = await listCustomTabs(marketCode).catch(() => [])
  if (tabs.some((tab) => tab.slug === segment)) {
    return null
  }
  return '/'
}
