import type { AdSlotVariant } from '@/lib/ad-config'

/** Ad size/style configured in page Configuration. */
export type PageAdType = AdSlotVariant

/** Where a configured ad renders on a public page. */
export type PageAdLocation =
  | 'masthead'
  | 'after_hero'
  | 'before_section'
  | 'after_section'
  | 'hero_rail'
  | 'us_band'
  | 'editorial_band'
  | 'health_carousel'

/** One page-level ad placement from Configuration / feed. */
export interface IPageAdPlacement {
  adType: PageAdType
  location: PageAdLocation
  enabled: boolean
  anchorSlug: string | null
}

const AD_TYPES = new Set<PageAdType>([
  'leaderboard',
  'ribbon',
  'rail',
  'tall',
  'square',
  'sticky',
])

/**
 * Normalize a raw feed/API ad placement into the frontend shape.
 *
 * @param raw - Snake_case or camelCase placement row.
 * @returns Normalized placement, or null when invalid.
 */
export function mapPageAdPlacement(raw: {
  adType?: string
  ad_type?: string
  location?: string
  enabled?: boolean
  anchorSlug?: string | null
  anchor_slug?: string | null
}): IPageAdPlacement | null {
  const adType = String(raw.adType ?? raw.ad_type ?? '').trim().toLowerCase()
  const location = String(raw.location ?? '').trim().toLowerCase() as PageAdLocation
  if (!AD_TYPES.has(adType as PageAdType) || !location) {
    return null
  }
  const anchor = raw.anchorSlug ?? raw.anchor_slug ?? null
  return {
    adType: adType as PageAdType,
    location,
    enabled: raw.enabled !== false,
    anchorSlug: anchor ? String(anchor).trim().toLowerCase() : null,
  }
}

/**
 * Whether an enabled placement exists for a location (and optional section slug).
 *
 * @param placements - Page ad placements from the feed.
 * @param location - Placement location key.
 * @param anchorSlug - Required for before_section / after_section checks.
 * @returns True when at least one matching enabled placement exists.
 */
export function isAdEnabled(
  placements: IPageAdPlacement[] | undefined,
  location: PageAdLocation,
  anchorSlug?: string | null,
): boolean {
  return findAdPlacement(placements, location, anchorSlug) !== null
}

/**
 * Decide whether to render an ad for a location under config-driven rules.
 * Empty placement lists keep legacy always-on behavior (e.g. politics).
 *
 * @param placements - Page ad placements from the feed.
 * @param location - Placement location key.
 * @param anchorSlug - Optional section slug for section-relative locations.
 * @returns True when the ad should render.
 */
export function shouldRenderConfiguredAd(
  placements: IPageAdPlacement[] | undefined,
  location: PageAdLocation,
  anchorSlug?: string | null,
): boolean {
  if (!placements || placements.length === 0) {
    return true
  }
  return isAdEnabled(placements, location, anchorSlug)
}

/**
 * Find the first enabled placement for a location.
 *
 * @param placements - Page ad placements from the feed.
 * @param location - Placement location key.
 * @param anchorSlug - Optional section slug for section-relative locations.
 * @returns Matching placement or null.
 */
export function findAdPlacement(
  placements: IPageAdPlacement[] | undefined,
  location: PageAdLocation,
  anchorSlug?: string | null,
): IPageAdPlacement | null {
  if (!placements || placements.length === 0) {
    return null
  }
  const normalizedAnchor = anchorSlug ? anchorSlug.trim().toLowerCase() : null
  for (const placement of placements) {
    if (!placement.enabled || placement.location !== location) {
      continue
    }
    if (location === 'before_section' || location === 'after_section') {
      if (placement.anchorSlug === normalizedAnchor) {
        return placement
      }
      continue
    }
    return placement
  }
  return null
}

/**
 * Resolve the AdSlot variant from a configured ad type.
 *
 * @param placement - Matching placement, if any.
 * @param fallback - Variant when no placement is configured.
 * @returns Variant for AdSlot.
 */
export function resolveAdVariant(
  placement: IPageAdPlacement | null,
  fallback: AdSlotVariant,
): AdSlotVariant {
  return placement?.adType ?? fallback
}
