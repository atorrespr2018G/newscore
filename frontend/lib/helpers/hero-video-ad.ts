import type { AdsMode } from '@/lib/ad-config'

/** sessionStorage key set when a public homepage hero story is clicked. */
export const HERO_VIDEO_AD_STORAGE_KEY = 'newscore.hero-video-ad'

/** Milliseconds before the skip control is enabled. */
export const HERO_VIDEO_AD_SKIP_AFTER_MS = 5000

/** Centered player max width, matched to a 16:9 high-impact unit. */
export const HERO_VIDEO_AD_MAX_WIDTH_PX = 896

export interface IShouldShowHeroVideoAdOptions {
  pendingSlug: string | null
  articleSlug: string
  mode: AdsMode
}

export interface IHeroVideoAdStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

/**
 * Resolve sessionStorage when running in a browser.
 *
 * @returns The session store, or null during SSR / when storage is blocked.
 */
function getSessionStorage(): IHeroVideoAdStorage | null {
  if (typeof globalThis.sessionStorage === 'undefined') {
    return null
  }
  return globalThis.sessionStorage
}

/**
 * Decode and trim an article slug for pending-ad comparisons.
 *
 * @param slug Raw slug from a card, URL, or storage.
 * @returns Normalized slug.
 */
export function normalizeHeroVideoAdSlug(slug: string): string {
  const trimmed = slug.trim()
  try {
    return decodeURIComponent(trimmed)
  } catch {
    return trimmed
  }
}

/**
 * Read the pending hero-click slug without clearing it.
 *
 * Clearing on read breaks React Strict Mode: the article overlay remounts,
 * consumes the key, then mounts again with nothing left to show.
 *
 * @param storage Optional storage override for tests.
 * @returns The pending slug, or null when none is stored.
 */
export function peekHeroVideoAdPending(
  storage: IHeroVideoAdStorage | null = getSessionStorage(),
): string | null {
  if (!storage) {
    return null
  }
  const slug = storage.getItem(HERO_VIDEO_AD_STORAGE_KEY)
  return slug ? normalizeHeroVideoAdSlug(slug) : null
}

/**
 * Drop the pending hero-click slug after the overlay has been dismissed.
 *
 * @param storage Optional storage override for tests.
 */
export function clearHeroVideoAdPending(
  storage: IHeroVideoAdStorage | null = getSessionStorage(),
): void {
  storage?.removeItem(HERO_VIDEO_AD_STORAGE_KEY)
}

/**
 * Record that the next article view should open the hero-click video ad.
 *
 * @param slug Article slug that was selected from the homepage.
 * @param storage Optional storage override for tests.
 * @throws Error when the slug is empty.
 */
export function markHeroVideoAdPending(
  slug: string,
  storage: IHeroVideoAdStorage | null = getSessionStorage(),
): void {
  const trimmed = normalizeHeroVideoAdSlug(slug)
  if (!trimmed) {
    throw new Error('Hero video ad pending slug must be non-empty')
  }
  if (!storage) {
    return
  }
  storage.setItem(HERO_VIDEO_AD_STORAGE_KEY, trimmed)
}

/**
 * Whether the article page should open the centered hero-click video ad.
 *
 * @param options Pending slug, current article slug, and ads mode.
 * @returns True when this article was opened from the homepage and ads are on.
 */
export function shouldShowHeroVideoAd(options: IShouldShowHeroVideoAdOptions): boolean {
  if (options.mode === 'off') {
    return false
  }
  const pending = options.pendingSlug ? normalizeHeroVideoAdSlug(options.pendingSlug) : null
  const current = normalizeHeroVideoAdSlug(options.articleSlug)
  return Boolean(pending) && pending === current
}

/**
 * Parse the article slug from a public article pathname.
 *
 * @param pathname Current URL pathname.
 * @returns Normalized slug, or null when the path is not an article.
 */
export function articleSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/\/article\/([^/]+)\/?$/)
  if (!match?.[1]) {
    return null
  }
  return normalizeHeroVideoAdSlug(match[1])
}

/**
 * Seconds remaining until the skip control is enabled.
 *
 * @param elapsedMs Milliseconds since the overlay opened.
 * @param skipAfterMs Skip delay in milliseconds.
 * @returns Whole seconds left, or 0 when skip is available.
 */
export function remainingSkipSeconds(elapsedMs: number, skipAfterMs: number): number {
  return Math.max(0, Math.ceil((skipAfterMs - elapsedMs) / 1000))
}
