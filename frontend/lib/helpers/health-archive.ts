import type { IFeedSlot } from '@/interfaces/feed'
import { selectSportsPageSectionSlots } from '@/lib/helpers/feed-layout'
import { healthPagePath } from '@/lib/helpers/section-labels'

/** CMS page name for the Health landing page. */
export const HEALTH_PAGE_NAME = 'health'

/** Articles fetched per Health topic archive page. */
export const HEALTH_CATEGORY_PAGE_SIZE = 16

/**
 * Build an Health topic archive href when the compact band is on that page.
 *
 * Homepage Health heading uses `homepageSectionLandingHref` instead.
 *
 * @param pageName Layout page name such as `health`.
 * @param positionKey Slot position key / topic slug.
 * @returns Archive path, or null when the heading should not link.
 */
export function healthArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  if (pageName?.trim().toLowerCase() !== HEALTH_PAGE_NAME) {
    return null
  }
  const slug = positionKey.trim().toLowerCase()
  if (!slug) {
    return null
  }
  return healthPagePath(slug)
}

/**
 * Find the compact Health row whose position key matches a URL slug.
 *
 * @param slots Health page feed slots.
 * @param slug Topic slug from `/health/[slug]`.
 * @returns Matching compact topic slot, or undefined when the slug is not a topic.
 */
export function findHealthArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return selectSportsPageSectionSlots(slots).find(
    (slot) => slot.positionKey.trim().toLowerCase() === normalized,
  )
}
