import type { IFeedSlot } from '@/interfaces/feed'
import { selectSportsPageSectionSlots } from '@/lib/helpers/feed-layout'
import { governmentPagePath } from '@/lib/helpers/section-labels'

/** CMS page name for the Government landing page. */
export const GOVERNMENT_PAGE_NAME = 'government'

/** Articles fetched per Government topic archive page. */
export const GOVERNMENT_CATEGORY_PAGE_SIZE = 16

/**
 * Build a Government topic archive href when the compact band is on that page.
 *
 * Homepage Government heading uses `homepageSectionLandingHref` instead.
 *
 * @param pageName Layout page name such as `government`.
 * @param positionKey Slot position key / topic slug.
 * @returns Archive path, or null when the heading should not link.
 */
export function governmentArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  if (pageName?.trim().toLowerCase() !== GOVERNMENT_PAGE_NAME) {
    return null
  }
  const slug = positionKey.trim().toLowerCase()
  if (!slug) {
    return null
  }
  return governmentPagePath(slug)
}

/**
 * Find the compact Government row whose position key matches a URL slug.
 *
 * @param slots Government page feed slots.
 * @param slug Topic slug from `/government/[slug]`.
 * @returns Matching compact topic slot, or undefined when the slug is not a topic.
 */
export function findGovernmentArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return selectSportsPageSectionSlots(slots).find(
    (slot) => slot.positionKey.trim().toLowerCase() === normalized,
  )
}
