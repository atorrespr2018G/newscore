import type { IFeedSlot } from '@/interfaces/feed'
import { selectSportsPageSectionSlots } from '@/lib/helpers/feed-layout'

/** Articles fetched per custom-tab topic archive page. */
export const CUSTOM_TAB_CATEGORY_PAGE_SIZE = 16

/**
 * Build a custom-tab topic archive href when the compact band is on that page.
 *
 * @param pageName Layout page name (custom tab slug).
 * @param positionKey Slot position key / topic slug.
 * @param knownCustomPageNames Registered custom tab slugs.
 * @returns Archive path, or null when the heading should not link.
 */
export function customTabArchiveHref(
  pageName: string | undefined,
  positionKey: string,
  knownCustomPageNames: ReadonlySet<string>,
): string | null {
  const page = pageName?.trim().toLowerCase()
  if (!page || !knownCustomPageNames.has(page)) {
    return null
  }
  const slug = positionKey.trim().toLowerCase()
  if (!slug) {
    return null
  }
  return customTabTopicPath(page, slug)
}

/**
 * Landing path for a custom tab.
 *
 * @param pageName Custom tab slug.
 * @returns Path like `/science`.
 */
export function customTabPagePath(pageName: string): string {
  const normalized = pageName.trim().toLowerCase()
  return `/${encodeURIComponent(normalized)}`
}

/**
 * Topic archive path under a custom tab.
 *
 * @param pageName Custom tab slug.
 * @param topicSlug Topic section slug.
 * @returns Path like `/science/climate`.
 */
export function customTabTopicPath(pageName: string, topicSlug: string): string {
  const page = pageName.trim().toLowerCase()
  const slug = topicSlug.trim().toLowerCase()
  return `/${encodeURIComponent(page)}/${encodeURIComponent(slug)}`
}

/**
 * Find the compact custom-tab row whose position key matches a URL slug.
 *
 * @param slots Page feed slots.
 * @param slug Topic slug from `/{section}/[slug]`.
 * @returns Matching compact topic slot, or undefined when not a topic.
 */
export function findCustomTabArchiveSlot(
  slots: IFeedSlot[],
  slug: string,
): IFeedSlot | undefined {
  const normalized = slug.trim().toLowerCase()
  return selectSportsPageSectionSlots(slots).find(
    (slot) => slot.positionKey.trim().toLowerCase() === normalized,
  )
}
