import type { SportsPageSlotKind } from '@/lib/helpers/feed-layout'

/** Compact sport rows per ad-ribbon pair on sports-style pages. */
const SPORTS_SECTION_PAIR_SIZE = 2

/**
 * Whether an ad ribbon should precede a sports-style page slot.
 *
 * @param options Current slot kind and compact-row index.
 * @returns True when an AdRibbon should render before this slot.
 */
export function shouldInsertSportsAdBefore(options: {
  kind: SportsPageSlotKind
  previousKind: SportsPageSlotKind | null
  compactIndex: number
}): boolean {
  const { kind, previousKind, compactIndex } = options
  if (kind === 'ribbon_ad' || kind === 'section_archive') {
    return false
  }
  if (kind === 'live_carousel') {
    return true
  }
  if (kind === 'featured_band' && previousKind !== null && previousKind !== 'hero') {
    return true
  }
  if (kind === 'compact_six' && compactIndex > 0 && compactIndex % SPORTS_SECTION_PAIR_SIZE === 0) {
    return true
  }
  return false
}
