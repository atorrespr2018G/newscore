import type { IFeedSlot } from '@/interfaces/feed'
import { normalizedPositionKey } from '@/lib/helpers/feed-layout'

const AD_RIBBON_ALWAYS_BEFORE_SECTION_KEYS = new Set(['politics'])
const AD_RIBBON_TRANSITIONS = new Set(['politics>world', 'world>technology', 'world>politics'])

/**
 * Determine whether to inject an ad ribbon before a homepage grid slot.
 *
 * @param previousSlot Previously rendered slot, if any.
 * @param slot Current slot candidate.
 * @returns True when an ad ribbon should be rendered.
 */
export function shouldRenderHomepageGridAd(previousSlot: IFeedSlot | undefined, slot: IFeedSlot): boolean {
  const currentKey = normalizedPositionKey(slot)
  if (AD_RIBBON_ALWAYS_BEFORE_SECTION_KEYS.has(currentKey)) {
    return true
  }

  const previousKey = previousSlot ? normalizedPositionKey(previousSlot) : ''
  return AD_RIBBON_TRANSITIONS.has(`${previousKey}>${currentKey}`)
}
