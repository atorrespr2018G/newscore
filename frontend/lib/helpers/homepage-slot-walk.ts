import {
  normalizedPositionKey,
  resolveHomepagePageSlotKind,
} from '@/lib/helpers/feed-layout'
import type { IEditorialBandSlots, HomepagePageSlotKind } from '@/lib/helpers/feed-layout'
import { shouldRenderHomepageGridAd } from '@/lib/helpers/homepage-ad-placement'
import type { IFeedSlot } from '@/interfaces/feed'

/** Post-politics section keys preceded by an ad ribbon on the homepage. */
const POST_POLITICS_AD_SECTION_KEYS = ['health', 'finance', 'technology', 'world'] as const

/** Politics compact-row position key. */
export const POLITICS_POSITION_KEY = 'politics'
/** Leftover homepage Elections rows are skipped, not rendered. */
export const ELECTION_POSITION_KEY = 'midterm-elections'
/** Sports compact-row position key paired with Politics. */
export const SPORTS_POSITION_KEY = 'sports'

/** Result of consuming a Politics (+ Sports) compact cluster. */
export interface IPoliticsSectionCluster {
  politics: IFeedSlot
  sports: IFeedSlot | undefined
  consumed: number
}

/**
 * Whether an ad ribbon should precede a main-page slot in the ordered walk.
 *
 * @param options Current and previous slot context.
 * @returns True when an AdRibbon should render before this slot.
 */
export function shouldInsertHomepageAdBefore(options: {
  slot: IFeedSlot
  kind: HomepagePageSlotKind
  previousSlot: IFeedSlot | null
  previousKind: HomepagePageSlotKind | null
}): boolean {
  const { slot, kind, previousSlot, previousKind } = options
  if (previousKind === null || kind === 'ribbon_ad') {
    return false
  }
  if (kind === 'live_carousel' || kind === 'editorial_lead') {
    return true
  }
  if (kind === 'compact_six') {
    return shouldInsertCompactSixAdBefore(slot, previousSlot)
  }
  return false
}

/**
 * Whether a compact-six row should be preceded by a homepage ad ribbon.
 *
 * @param slot Current compact-six slot.
 * @param previousSlot Previously rendered slot, if any.
 * @returns True when an ad ribbon should render before this row.
 */
function shouldInsertCompactSixAdBefore(
  slot: IFeedSlot,
  previousSlot: IFeedSlot | null,
): boolean {
  const key = normalizedPositionKey(slot)
  if ((POST_POLITICS_AD_SECTION_KEYS as readonly string[]).includes(key)) {
    return true
  }
  if (key === POLITICS_POSITION_KEY) {
    return true
  }
  return shouldRenderHomepageGridAd(previousSlot ?? undefined, slot)
}

/**
 * Consume consecutive editorial lead + spotlight (+ optional rail) as one band.
 *
 * @param slots Remaining feed slots starting at the lead.
 * @returns Band and number of slots consumed, or null when not a band.
 */
export function takeEditorialBand(
  slots: IFeedSlot[],
): { band: IEditorialBandSlots; consumed: number } | null {
  const lead = slots[0]
  const spotlight = slots[1]
  if (!lead || !spotlight) {
    return null
  }
  if (resolveHomepagePageSlotKind(lead) !== 'editorial_lead') {
    return null
  }
  if (resolveHomepagePageSlotKind(spotlight) !== 'editorial_spotlight') {
    return null
  }
  if (normalizedPositionKey(spotlight) === ELECTION_POSITION_KEY) {
    return null
  }
  const rail = slots[2]
  if (rail && resolveHomepagePageSlotKind(rail) === 'rail_compact') {
    return { band: { lead, spotlight, rail }, consumed: 3 }
  }
  return { band: { lead, spotlight }, consumed: 2 }
}

/**
 * Consume consecutive Politics + Sports compact rows as one module.
 *
 * Leftover homepage Elections rows are skipped, not rendered.
 *
 * @param slots Remaining feed slots.
 * @returns Paired slots and count consumed, or null.
 */
export function takePoliticsSectionCluster(
  slots: IFeedSlot[],
): IPoliticsSectionCluster | null {
  const first = slots[0]
  if (!first || normalizedPositionKey(first) !== POLITICS_POSITION_KEY) {
    return null
  }
  if (resolveHomepagePageSlotKind(first) !== 'compact_six') {
    return null
  }

  let consumed = 1
  let cursor = 1
  const second = slots[cursor]
  if (second && normalizedPositionKey(second) === ELECTION_POSITION_KEY) {
    consumed += 1
    cursor += 1
  }

  const sportsSlot = slots[cursor]
  if (sportsSlot && normalizedPositionKey(sportsSlot) === SPORTS_POSITION_KEY) {
    return { politics: first, sports: sportsSlot, consumed: consumed + 1 }
  }
  return { politics: first, sports: undefined, consumed }
}

/**
 * Whether the feed already includes configuration-driven ribbon advertisement slots.
 *
 * @param slots Ordered feed slots.
 * @returns True when heuristic ribbons should be suppressed.
 */
export function feedHasConfiguredRibbonAds(slots: IFeedSlot[]): boolean {
  return slots.some((slot) => resolveHomepagePageSlotKind(slot) === 'ribbon_ad')
}

/**
 * Whether the ordered feed already owns the ribbon immediately after Hero.
 *
 * Other configured ribbons must not suppress this homepage fallback.
 *
 * @param slots Ordered feed slots.
 * @returns True when a ribbon_ad slot follows the hero.
 */
export function feedHasConfiguredPostHeroRibbonAd(slots: IFeedSlot[]): boolean {
  const heroIndex = slots.findIndex((slot) => resolveHomepagePageSlotKind(slot) === 'hero')
  if (heroIndex < 0) {
    return false
  }
  const nextSlot = slots[heroIndex + 1]
  return nextSlot ? resolveHomepagePageSlotKind(nextSlot) === 'ribbon_ad' : false
}
