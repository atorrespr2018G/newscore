import type { IFeedSlot } from '@/interfaces/feed'
import { selectSportsPageSectionSlots } from '@/lib/helpers/feed-layout'
import { businessPagePath } from '@/lib/helpers/section-labels'

/** CMS page name for the Economía landing page. */
export const BUSINESS_PAGE_NAME = 'business'

/** Articles fetched per Economía beat archive page. */
export const BUSINESS_CATEGORY_PAGE_SIZE = 16

/**
 * Build an Economía beat archive href when the compact band is on the Business page.
 *
 * Homepage compact bands keep a plain heading.
 *
 * @param pageName Layout page name such as `business`.
 * @param positionKey Slot position key / beat slug.
 * @returns Archive path, or null when the heading should not link.
 */
export function businessArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  if (pageName?.trim().toLowerCase() !== BUSINESS_PAGE_NAME) {
    return null
  }
  const slug = positionKey.trim().toLowerCase()
  if (!slug) {
    return null
  }
  return businessPagePath(slug)
}

/**
 * Find the compact Economía row whose position key matches a URL slug.
 *
 * @param slots Business page feed slots.
 * @param slug Beat slug from `/business/[slug]`.
 * @returns Matching compact beat slot, or undefined when the slug is not a beat.
 */
export function findBusinessArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return selectSportsPageSectionSlots(slots).find(
    (slot) => slot.positionKey.trim().toLowerCase() === normalized,
  )
}
