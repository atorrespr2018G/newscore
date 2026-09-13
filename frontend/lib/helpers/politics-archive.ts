import type { IArticle, IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { normalizedPositionKey } from '@/lib/helpers/feed-layout'
import { politicsPagePath } from '@/lib/helpers/section-labels'
import {
  PRESENTATION_FEATURED_BAND,
  PRESENTATION_HERO,
  PRESENTATION_LIVE_CAROUSEL,
  PRESENTATION_RIBBON_AD,
} from '@/lib/presentation-types'

/** CMS page name for the Politics landing page. */
export const POLITICS_PAGE_NAME = 'politics'

/**
 * Parent Politics category that seeded topic slots actually query.
 *
 * Congress, Policy, and the other columns are labels on the same `politics`
 * article pool until stories are tagged with a dedicated topic category.
 */
export const POLITICS_PARENT_CATEGORY_SLUG = 'politics'

/** Articles fetched per Politics topic archive page. */
export const POLITICS_CATEGORY_PAGE_SIZE = 16

/** Politics slots that are not clickable topic archives. */
const POLITICS_PAGE_NON_TOPIC_KEYS = new Set(['hero', 'us-featured', 'health'])

/**
 * Friendly archive slugs for seeded Politics topic rows.
 *
 * Compact and editorial columns keep layout position keys; public URLs use
 * topic slugs such as `congress` and `policy`.
 */
export const POLITICS_TOPIC_ARCHIVE_SLUG_BY_POSITION: Record<string, string> = {
  'more-top-stories': 'congress',
  'politics-spotlight': 'elections',
  'editorial-rail': 'white-house',
  'politics-latest': 'policy',
  'politics-courts': 'courts',
  'politics-state': 'state-politics',
  'politics-opinion': 'opinion',
}

const POLITICS_NON_TOPIC_PRESENTATIONS = new Set([
  PRESENTATION_HERO,
  PRESENTATION_FEATURED_BAND,
  PRESENTATION_LIVE_CAROUSEL,
  PRESENTATION_RIBBON_AD,
])

/**
 * Public archive slug for a Politics-page topic slot.
 *
 * @param positionKey Layout position key such as `politics-latest`.
 * @returns URL slug such as `policy`.
 */
export function politicsTopicArchiveSlug(positionKey: string): string {
  const key = positionKey.trim().toLowerCase()
  return POLITICS_TOPIC_ARCHIVE_SLUG_BY_POSITION[key] ?? key
}

/**
 * Preferred category slug for a Politics topic (editor taxonomy / tagged stories).
 *
 * @param positionKey Layout position key such as `more-top-stories`.
 * @returns Category slug such as `congress`.
 */
export function politicsTopicCategorySlug(positionKey: string): string {
  return politicsTopicArchiveSlug(positionKey)
}

/**
 * Category slugs to try for a topic archive, matching Health › Food when tagged.
 *
 * Dedicated topic slugs are tried first. The parent `politics` pool is next
 * so archives are not empty before stories are tagged to Congress or Policy.
 *
 * @param positionKey Layout position key such as `politics-latest`.
 * @returns Slugs to query, dedicated topic first.
 */
export function politicsArchiveCategorySlugs(positionKey: string): string[] {
  const primary = politicsTopicCategorySlug(positionKey)
  if (primary === POLITICS_PARENT_CATEGORY_SLUG) {
    return [POLITICS_PARENT_CATEGORY_SLUG]
  }
  return [primary, POLITICS_PARENT_CATEGORY_SLUG]
}

/**
 * Paginate articles already resolved on a Politics topic slot.
 *
 * Used when category queries are empty so the archive still shows the same
 * stories the Politics landing already placed under that heading.
 *
 * @param articles Slot articles from the Politics page feed.
 * @param page 1-indexed page number.
 * @returns Paginated connection for the archive page.
 */
export function archiveConnectionFromPoliticsArticles(
  articles: IArticle[],
  page: number,
): IArticleConnection {
  const pageSize = POLITICS_CATEGORY_PAGE_SIZE
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
 * Whether a Politics-page position key is a selectable topic archive.
 *
 * @param positionKey Slot position key.
 * @returns True for Congress, Policy, and other topic rows.
 */
export function isPoliticsTopicPositionKey(positionKey: string): boolean {
  const key = positionKey.trim().toLowerCase()
  if (!key || key === 'ad-ribbon' || key.startsWith('ad-ribbon-')) {
    return false
  }
  return !POLITICS_PAGE_NON_TOPIC_KEYS.has(key)
}

/**
 * Whether a Politics feed slot should link to a topic archive.
 *
 * @param slot Politics-page feed slot.
 * @returns True when the heading should navigate to `/politics/{topic}`.
 */
export function isPoliticsTopicArchiveSlot(slot: IFeedSlot): boolean {
  const presentation = slot.presentationType.trim().toLowerCase()
  if (POLITICS_NON_TOPIC_PRESENTATIONS.has(presentation)) {
    return false
  }
  return isPoliticsTopicPositionKey(slot.positionKey)
}

/**
 * Build a topic archive href when the compact or editorial band is on Politics.
 *
 * @param pageName Layout page name such as `politics`.
 * @param positionKey Slot position key / topic slug.
 * @returns Archive path, or null when the heading should not link.
 */
export function politicsArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  if (pageName?.trim().toLowerCase() !== POLITICS_PAGE_NAME) {
    return null
  }
  if (!isPoliticsTopicPositionKey(positionKey)) {
    return null
  }
  return politicsPagePath(politicsTopicArchiveSlug(positionKey))
}

/**
 * Find the Politics topic slot whose position key or archive slug matches.
 *
 * @param slots Politics page feed slots.
 * @param slug Topic slug from `/politics/[slug]`.
 * @returns Matching topic slot, or undefined when the slug is not a topic.
 */
export function findPoliticsArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return slots.filter(isPoliticsTopicArchiveSlot).find((slot) => {
    const key = normalizedPositionKey(slot)
    return key === normalized || politicsTopicArchiveSlug(key) === normalized
  })
}
