import type { IArticle, IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { normalizedPositionKey } from '@/lib/helpers/feed-layout'
import { worldPagePath } from '@/lib/helpers/section-labels'
import {
  PRESENTATION_FEATURED_BAND,
  PRESENTATION_HERO,
  PRESENTATION_LIVE_CAROUSEL,
  PRESENTATION_RIBBON_AD,
} from '@/lib/presentation-types'

/** CMS page name for the World landing page. */
export const WORLD_PAGE_NAME = 'world'

/**
 * Parent World category that seeded region slots actually query.
 *
 * Europe, Asia, and the other World columns are labels on the same `world`
 * article pool until stories are tagged with a dedicated region category.
 */
export const WORLD_PARENT_CATEGORY_SLUG = 'world'

/** Articles fetched per World region archive page. */
export const WORLD_REGION_PAGE_SIZE = 16

/** World slots that are not clickable geographic regions. */
const WORLD_PAGE_NON_REGION_KEYS = new Set(['hero', 'us-featured', 'health'])

/**
 * Friendly archive slugs for seeded World region rows.
 *
 * Compact category rows keep their position key as the category slug
 * (`world-latest` for Asia) so existing tagged stories still resolve.
 */
export const WORLD_REGION_ARCHIVE_SLUG_BY_POSITION: Record<string, string> = {
  'more-top-stories': 'usa-canada',
  'world-spotlight': 'europe',
  'editorial-rail': 'latin-america',
  'world-latest': 'asia',
  'world-regions': 'oceania',
  'world-middle-east': 'middle-east',
  'world-africa': 'africa',
}

/** Category slug overrides when the position key is not the article pool. */
export const WORLD_REGION_CATEGORY_SLUG_BY_POSITION: Record<string, string> = {
  'more-top-stories': 'usa-canada',
  'world-spotlight': 'europe',
  'editorial-rail': 'latin-america',
}

const WORLD_NON_REGION_PRESENTATIONS = new Set([
  PRESENTATION_HERO,
  PRESENTATION_FEATURED_BAND,
  PRESENTATION_LIVE_CAROUSEL,
  PRESENTATION_RIBBON_AD,
])

/**
 * Public archive slug for a World-page region slot.
 *
 * @param positionKey Layout position key such as `world-spotlight`.
 * @returns URL slug such as `europe`.
 */
export function worldRegionArchiveSlug(positionKey: string): string {
  const key = positionKey.trim().toLowerCase()
  return WORLD_REGION_ARCHIVE_SLUG_BY_POSITION[key] ?? key
}

/**
 * Preferred category slug for a World region (editor taxonomy / tagged stories).
 *
 * @param positionKey Layout position key such as `world-spotlight`.
 * @returns Category slug such as `europe` or `world-latest`.
 */
export function worldRegionCategorySlug(positionKey: string): string {
  const key = positionKey.trim().toLowerCase()
  return WORLD_REGION_CATEGORY_SLUG_BY_POSITION[key] ?? key
}

/**
 * Category slugs to try for a region archive, matching the World landing pool.
 *
 * Seeded World columns fill from `world`, so that pool is queried first.
 * A dedicated region slug is tried next once stories are tagged to it.
 *
 * @param positionKey Layout position key such as `world-spotlight`.
 * @returns Slugs to query, landing pool first.
 */
export function worldArchiveCategorySlugs(positionKey: string): string[] {
  const primary = worldRegionCategorySlug(positionKey)
  if (primary === WORLD_PARENT_CATEGORY_SLUG) {
    return [WORLD_PARENT_CATEGORY_SLUG]
  }
  return [WORLD_PARENT_CATEGORY_SLUG, primary]
}

/**
 * Paginate articles already resolved on a World region slot.
 *
 * Used when category queries are empty so the archive still shows the same
 * stories the World landing already placed under that region heading.
 *
 * @param articles Slot articles from the World page feed.
 * @param page 1-indexed page number.
 * @returns Paginated connection for the archive page.
 */
export function archiveConnectionFromArticles(
  articles: IArticle[],
  page: number,
): IArticleConnection {
  const pageSize = WORLD_REGION_PAGE_SIZE
  const start = Math.max(0, (page - 1) * pageSize)
  const items = articles.slice(start, start + pageSize)
  return {
    items,
    total: articles.length,
    page,
    pageSize,
    hasMore: start + items.length < articles.length,
  }
}

/**
 * Whether a World-page position key is a selectable region archive.
 *
 * @param positionKey Slot position key.
 * @returns True for Europe, Latin America, Asia, and other region rows.
 */
export function isWorldRegionPositionKey(positionKey: string): boolean {
  const key = positionKey.trim().toLowerCase()
  if (!key || key === 'ad-ribbon' || key.startsWith('ad-ribbon-')) {
    return false
  }
  return !WORLD_PAGE_NON_REGION_KEYS.has(key)
}

/**
 * Whether a World feed slot should link to a region archive.
 *
 * @param slot World-page feed slot.
 * @returns True when the heading should navigate to `/world/{region}`.
 */
export function isWorldRegionArchiveSlot(slot: IFeedSlot): boolean {
  const presentation = slot.presentationType.trim().toLowerCase()
  if (WORLD_NON_REGION_PRESENTATIONS.has(presentation)) {
    return false
  }
  return isWorldRegionPositionKey(slot.positionKey)
}

/**
 * Build a region archive href when the compact or editorial band is on World.
 *
 * @param pageName Layout page name such as `world`.
 * @param positionKey Slot position key / region slug.
 * @returns Archive path, or null when the heading should not link.
 */
export function worldArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  if (pageName?.trim().toLowerCase() !== WORLD_PAGE_NAME) {
    return null
  }
  if (!isWorldRegionPositionKey(positionKey)) {
    return null
  }
  return worldPagePath(worldRegionArchiveSlug(positionKey))
}

/**
 * Find the World region slot whose position key or archive slug matches.
 *
 * @param slots World page feed slots.
 * @param slug Region slug from `/world/[slug]`.
 * @returns Matching region slot, or undefined when the slug is not a region.
 */
export function findWorldArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return slots.filter(isWorldRegionArchiveSlot).find((slot) => {
    const key = normalizedPositionKey(slot)
    return key === normalized || worldRegionArchiveSlug(key) === normalized
  })
}
