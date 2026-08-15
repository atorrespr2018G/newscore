import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { selectSportsPageSectionSlots } from '@/lib/helpers/feed-layout'
import { sportPagePath } from '@/lib/helpers/section-labels'

/** CMS page name for the Sports landing page. */
export const SPORTS_PAGE_NAME = 'sports'

/** Articles shown on one sport archive page (matches backend DEFAULT_PAGE_SIZE). */
export const SPORT_CATEGORY_PAGE_SIZE = 20

/** Compact rail stories stacked beside the featured card. */
export const SPORT_ARCHIVE_RAIL_COUNT = 4

/** Maximum characters for a sport-archive excerpt under the headline. */
export const SPORT_ARCHIVE_EXCERPT_MAX_CHARS = 180

/** Featured, rail, and remaining grid stories for a Metro-style archive. */
export interface ISportArchiveLayout {
  featured: IArticle | null
  rail: IArticle[]
  grid: IArticle[]
}

/**
 * Build a sport archive href when the compact band is on the Sports page.
 *
 * Homepage and world compact bands keep a plain heading.
 *
 * @param pageName Layout page name such as `sports`.
 * @param positionKey Slot position key / sport slug.
 * @returns Archive path, or null when the heading should not link.
 */
export function sportArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  if (pageName?.trim().toLowerCase() !== SPORTS_PAGE_NAME) {
    return null
  }
  const slug = positionKey.trim().toLowerCase()
  if (!slug) {
    return null
  }
  return sportPagePath(slug)
}

/**
 * Parse a 1-indexed archive page from a Next.js search param.
 *
 * @param raw Query value from `searchParams.page`.
 * @returns Page number, defaulting to 1 when missing or invalid.
 */
export function parseArchivePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(value ?? '1', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }
  return parsed
}

/**
 * Build an archive pagination href, omitting `page` on the first page.
 *
 * @param basePath Path such as `/sports/baseball`.
 * @param page 1-indexed page number.
 * @returns Path, optionally with a `page` query string.
 */
export function archivePageHref(basePath: string, page: number): string {
  if (page <= 1) {
    return basePath
  }
  return `${basePath}?page=${page}`
}

/**
 * Find the compact sport row whose position key matches a URL slug.
 *
 * @param slots Sports page feed slots.
 * @param slug Sport slug from `/sports/[slug]`.
 * @returns Matching compact sport slot, or undefined when the slug is not a sport.
 */
export function findSportArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return selectSportsPageSectionSlots(slots).find(
    (slot) => slot.positionKey.trim().toLowerCase() === normalized,
  )
}

/**
 * Split a newest-first list into Metro's featured + rail + 3-column grid.
 *
 * @param articles Category articles already sorted by published date.
 * @returns Featured lead, side rail, and remaining grid stories.
 */
export function splitSportArchiveLayout(articles: IArticle[]): ISportArchiveLayout {
  if (articles.length === 0) {
    return { featured: null, rail: [], grid: [] }
  }
  const featured = articles[0]
  const railEnd = 1 + SPORT_ARCHIVE_RAIL_COUNT
  return {
    featured,
    rail: articles.slice(1, railEnd),
    grid: articles.slice(railEnd),
  }
}

/**
 * First letter used in the Metro-style author avatar.
 *
 * @param name Author display name.
 * @returns Uppercase initial, or a fallback mark when empty.
 */
export function authorInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return '?'
  }
  return trimmed.charAt(0).toUpperCase()
}
