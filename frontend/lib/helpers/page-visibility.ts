import { HOMEPAGE_PAGE_NAME } from '@/lib/helpers/homepage-page-names'
import { sectionPageName } from '@/lib/helpers/section-labels'
import type { IFeedSlot } from '@/interfaces/feed'

/**
 * Whether a public landing may render for the current geo.
 *
 * Missing ``isEnabled`` is treated as enabled so older feed payloads stay visible.
 *
 * @param feed Page feed with optional enablement flags.
 * @returns False when Configuration disabled this landing for the active geo.
 */
export function isPublicPageEnabled(feed: {
  pageName: string
  isEnabled?: boolean
}): boolean {
  const pageName = feed.pageName.trim().toLowerCase()
  if (pageName === HOMEPAGE_PAGE_NAME) {
    return true
  }
  return feed.isEnabled !== false
}

/**
 * Whether a masthead or homepage band should be hidden because its landing is off.
 *
 * @param positionKey Homepage slot key such as ``sports`` or ``finance``.
 * @param disabledPageNames Layout page names disabled for the active geo.
 * @returns True when the matching landing is disabled.
 */
export function isLandingDisabled(
  positionKey: string,
  disabledPageNames: readonly string[] | undefined,
): boolean {
  if (!disabledPageNames?.length) {
    return false
  }
  const pageName = sectionPageName(positionKey)
  return disabledPageNames.includes(pageName)
}

/**
 * Drop homepage bands whose dedicated landing is disabled for this geo.
 *
 * @param slots Feed slots.
 * @param disabledPageNames Disabled layout page names.
 * @param pageName Current layout page name.
 * @returns Slots unchanged on non-homepage feeds.
 */
export function omitDisabledLandingSlots(
  slots: IFeedSlot[],
  disabledPageNames: readonly string[] | undefined,
  pageName: string,
): IFeedSlot[] {
  if (pageName.trim().toLowerCase() !== HOMEPAGE_PAGE_NAME) {
    return slots
  }
  return slots.filter((slot) => !isLandingDisabled(slot.positionKey, disabledPageNames))
}
