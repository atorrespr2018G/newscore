import type { AdSlotKey } from '@/lib/ad-config'

/** Simulated network latency before a mock creative is "received". */
export const MOCK_AD_LATENCY_MS = 300

/** Public sample used as the mock hero-click video advertisement. */
export const MOCK_VIDEO_AD_SRC =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'

export type MockCreativeId =
  | 'sponsoredBriefing'
  | 'brandSpotlight'
  | 'newswirePartner'
  | 'fullWidthCampaign'
  | 'crossScreen'
  | 'editorialPartner'

export interface IMockCreativeDefinition {
  id: MockCreativeId
  /** Tailwind background + text classes for the filled creative. */
  accentClass: string
}

export const MOCK_CREATIVE_CATALOG: readonly IMockCreativeDefinition[] = [
  { id: 'sponsoredBriefing', accentClass: 'bg-neutral-950 text-white' },
  { id: 'brandSpotlight', accentClass: 'bg-teal-900 text-white' },
  { id: 'newswirePartner', accentClass: 'bg-stone-800 text-white' },
  { id: 'fullWidthCampaign', accentClass: 'bg-amber-900 text-white' },
  { id: 'crossScreen', accentClass: 'bg-sky-950 text-white' },
  { id: 'editorialPartner', accentClass: 'bg-emerald-950 text-white' },
] as const

/**
 * Build a stable numeric hash for slot + index pairing.
 *
 * @param slotKey - Registered ad slot key.
 * @param index - Zero-based occurrence index on the page.
 * @returns Unsigned 32-bit hash.
 */
export function hashAdPlacement(slotKey: AdSlotKey, index: number): number {
  const seed = `${slotKey}:${index}`
  let hash = 2166136261

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

/**
 * Pick a deterministic mock creative for a slot occurrence.
 *
 * @param slotKey - Registered ad slot key.
 * @param index - Zero-based occurrence index on the page.
 * @returns Catalog entry for that placement.
 */
export function selectMockCreative(slotKey: AdSlotKey, index = 0): IMockCreativeDefinition {
  const catalogSize = MOCK_CREATIVE_CATALOG.length
  const creativeIndex = hashAdPlacement(slotKey, index) % catalogSize
  return MOCK_CREATIVE_CATALOG[creativeIndex]
}
