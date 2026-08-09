/** Reporter-parity taxonomy options and helpers for Media Desk stories. */

import { FLORIDA_STATE_CODE } from '@/lib/taxonomy/florida-counties'
import { PUERTO_RICO_MARKET_CODE } from '@/lib/taxonomy/puerto-rico-towns'
import { toRegionCode } from '@/lib/taxonomy/region-code'
import { US_MARKET_CODE } from '@/lib/taxonomy/us-states'

/** Market codes matching the NewsCore reporter country picker. */
export type MarketCode = 'us' | 'pr' | 'co'

export interface ILocalityOption {
  code: string
  label: string
}

export interface ICategoryOption {
  slug: string
  label: string
  parentSlug: string | null
}

/** Editorial rule: a story belongs to at least one and at most three sections. */
export const MIN_CATEGORY_COUNT = 1
export const MAX_CATEGORY_COUNT = 3

/** Parent slug for per-sport subcategory chips. */
export const SPORTS_CATEGORY_SLUG = 'sports'

/** Optional 1–10 international relevance score. */
export const INTERNATIONAL_POTENTIAL_OPTIONS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Country / market options shown in Story location. */
export const MARKET_OPTIONS: ILocalityOption[] = [
  { code: 'us', label: 'US' },
  { code: 'pr', label: 'PR' },
  { code: 'co', label: 'CO' },
]

/**
 * Root section chips matching the reporter category catalog.
 * `sports-page-world` is intentionally omitted (Sports-page only).
 */
export const ROOT_CATEGORY_OPTIONS: ICategoryOption[] = [
  { slug: 'us', label: 'US', parentSlug: null },
  { slug: 'world', label: 'World', parentSlug: null },
  { slug: 'politics', label: 'Politics', parentSlug: null },
  { slug: 'finance', label: 'Finance', parentSlug: null },
  { slug: 'technology', label: 'Technology', parentSlug: null },
  { slug: 'business', label: 'Business', parentSlug: null },
  { slug: 'health', label: 'Health', parentSlug: null },
  { slug: 'entertainment', label: 'Entertainment', parentSlug: null },
  { slug: 'style', label: 'Style', parentSlug: null },
  { slug: 'travel', label: 'Travel', parentSlug: null },
  { slug: 'sports', label: 'Sports', parentSlug: null },
]

/** Sport subcategory chips shown when Sports is selected. */
export const SPORT_CATEGORY_OPTIONS: ICategoryOption[] = [
  { slug: 'baseball', label: 'Baseball', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'basketball', label: 'Basketball', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'boxing', label: 'Boxing', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'volleyball', label: 'Volleyball', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'soccer', label: 'Soccer', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'surfing', label: 'Surfing', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'track-and-field', label: 'Track and Field', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'tennis', label: 'Tennis', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'golf', label: 'Golf', parentSlug: SPORTS_CATEGORY_SLUG },
  { slug: 'horse-racing', label: 'Horse Racing', parentSlug: SPORTS_CATEGORY_SLUG },
]

/** Default taxonomy values for a new or legacy story package. */
export const DEFAULT_STORY_TAXONOMY = {
  market_code: 'us' as MarketCode,
  town_id: null as string | null,
  county_id: null as string | null,
  category_slugs: [] as string[],
  international_potential: null as number | null,
}

/**
 * Whether the market uses a state (US) or town (PR) locality picker.
 * @param marketCode - Active market code.
 * @returns True when a locality select should render.
 */
export function marketHasLocality(marketCode: string): boolean {
  return marketCode === US_MARKET_CODE || marketCode === PUERTO_RICO_MARKET_CODE
}

/**
 * Whether Florida county picker should show for the current location.
 * @param marketCode - Active market code.
 * @param townId - Selected state/town code.
 * @returns True when county options apply.
 */
export function marketHasCounty(marketCode: string, townId: string | null): boolean {
  return marketCode === US_MARKET_CODE && townId === FLORIDA_STATE_CODE
}

/**
 * Toggle a category slug within the current selection, enforcing the max cap.
 * @param selected - Currently selected category slugs.
 * @param slug - Category slug being toggled.
 * @returns Updated selection.
 */
export function toggleCategorySlug(selected: string[], slug: string): string[] {
  if (selected.includes(slug)) {
    return selected.filter((item) => item !== slug)
  }
  if (selected.length >= MAX_CATEGORY_COUNT) {
    return selected
  }
  return [...selected, slug]
}

/**
 * Toggle a root section; unchecking Sports also clears sport children.
 * @param selected - Currently selected category slugs.
 * @param slug - Root category slug being toggled.
 * @returns Updated selection.
 */
export function toggleRootCategorySlug(selected: string[], slug: string): string[] {
  if (selected.includes(slug)) {
    const sportSlugs = new Set(SPORT_CATEGORY_OPTIONS.map((item) => item.slug))
    if (slug === SPORTS_CATEGORY_SLUG) {
      return selected.filter((item) => item !== slug && !sportSlugs.has(item))
    }
    return selected.filter((item) => item !== slug)
  }
  return toggleCategorySlug(selected, slug)
}

/**
 * Validate story taxonomy before marking a report ready.
 * @param categorySlugs - Selected category slugs.
 * @returns Error message, or null when valid.
 */
export function validateStoryTaxonomy(categorySlugs: string[]): string | null {
  if (categorySlugs.length < MIN_CATEGORY_COUNT) {
    return `Select at least ${MIN_CATEGORY_COUNT} category`
  }
  if (categorySlugs.length > MAX_CATEGORY_COUNT) {
    return `Select at most ${MAX_CATEGORY_COUNT} categories`
  }
  return null
}

/**
 * Build the canonical region code for handoff / display.
 * @param marketCode - Market short code.
 * @param townId - State or town code.
 * @param countyId - Optional Florida county code.
 * @returns Region code string.
 */
export function storyRegionCode(
  marketCode: string,
  townId: string | null,
  countyId: string | null,
): string {
  return toRegionCode(marketCode, townId, countyId)
}
