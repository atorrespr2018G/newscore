import type { IFeedSlot } from '@/interfaces/feed'
import { selectSportsPageSectionSlots } from '@/lib/helpers/feed-layout'
import { entertainmentPagePath } from '@/lib/helpers/section-labels'

/** CMS page name for the Entertainment landing page. */
export const ENTERTAINMENT_PAGE_NAME = 'entertainment'

/** Articles fetched per Entertainment topic archive page. */
export const ENTERTAINMENT_CATEGORY_PAGE_SIZE = 16

/**
 * Build an Entertainment topic archive href when the compact band is on that page.
 *
 * Homepage Entertainment heading uses `homepageSectionLandingHref` instead.
 *
 * @param pageName Layout page name such as `entertainment`.
 * @param positionKey Slot position key / topic slug.
 * @returns Archive path, or null when the heading should not link.
 */
export function entertainmentArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  if (pageName?.trim().toLowerCase() !== ENTERTAINMENT_PAGE_NAME) {
    return null
  }
  const slug = positionKey.trim().toLowerCase()
  if (!slug) {
    return null
  }
  return entertainmentPagePath(slug)
}

/**
 * Find the compact Entertainment row whose position key matches a URL slug.
 *
 * @param slots Entertainment page feed slots.
 * @param slug Topic slug from `/entertainment/[slug]`.
 * @returns Matching compact topic slot, or undefined when the slug is not a topic.
 */
export function findEntertainmentArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return selectSportsPageSectionSlots(slots).find(
    (slot) => slot.positionKey.trim().toLowerCase() === normalized,
  )
}
