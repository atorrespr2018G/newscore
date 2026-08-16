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

/** At least one category is required before marking ready / sending to Editor. */
export const MIN_CATEGORY_COUNT = 1

/** Parent slug for per-sport subcategory chips. */
export const SPORTS_CATEGORY_SLUG = 'sports'

/** Parent slug for Economía beat chips. */
export const BUSINESS_CATEGORY_SLUG = 'business'

/** Parent slug for Government topic chips. */
export const GOVERNMENT_CATEGORY_SLUG = 'government'

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
  { slug: 'government', label: 'Government', parentSlug: null },
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

/** Government topic chips shown when Government is selected. */
export const GOVERNMENT_CATEGORY_OPTIONS: ICategoryOption[] = [
  { slug: 'executive', label: 'Executive', parentSlug: GOVERNMENT_CATEGORY_SLUG },
  { slug: 'legislature', label: 'Legislature', parentSlug: GOVERNMENT_CATEGORY_SLUG },
  { slug: 'judiciary', label: 'Judiciary', parentSlug: GOVERNMENT_CATEGORY_SLUG },
  { slug: 'agencies', label: 'Agencies', parentSlug: GOVERNMENT_CATEGORY_SLUG },
  { slug: 'services', label: 'Services', parentSlug: GOVERNMENT_CATEGORY_SLUG },
  { slug: 'emergency', label: 'Emergency', parentSlug: GOVERNMENT_CATEGORY_SLUG },
  { slug: 'defense', label: 'Defense', parentSlug: GOVERNMENT_CATEGORY_SLUG },
]

/** Economía beat chips shown when Economy is selected. */
export const BUSINESS_CATEGORY_OPTIONS: ICategoryOption[] = [
  { slug: 'economy', label: 'Economy', parentSlug: BUSINESS_CATEGORY_SLUG },
  { slug: 'companies', label: 'Companies', parentSlug: BUSINESS_CATEGORY_SLUG },
  { slug: 'banking', label: 'Banking', parentSlug: BUSINESS_CATEGORY_SLUG },
  { slug: 'autos', label: 'Autos', parentSlug: BUSINESS_CATEGORY_SLUG },
  { slug: 'tourism', label: 'Tourism', parentSlug: BUSINESS_CATEGORY_SLUG },
  { slug: 'construction', label: 'Construction', parentSlug: BUSINESS_CATEGORY_SLUG },
  { slug: 'agriculture', label: 'Agriculture', parentSlug: BUSINESS_CATEGORY_SLUG },
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
 * Whether a slug is a per-sport subcategory under Sports.
 * @param slug - Category slug to check.
 * @returns True when the slug is one of the sport chips.
 */
export function isSportCategorySlug(slug: string): boolean {
  return SPORT_CATEGORY_OPTIONS.some((sport) => sport.slug === slug)
}

/**
 * Whether a slug is an Economía beat under Economy.
 *
 * @param slug - Category slug to check.
 * @returns True when the slug is one of the Economía beat chips.
 */
export function isBusinessBeatSlug(slug: string): boolean {
  return BUSINESS_CATEGORY_OPTIONS.some((beat) => beat.slug === slug)
}

/**
 * Whether a slug is a Government topic under Government.
 *
 * @param slug - Category slug to check.
 * @returns True when the slug is one of the Government topic chips.
 */
export function isGovernmentTopicSlug(slug: string): boolean {
  return GOVERNMENT_CATEGORY_OPTIONS.some((topic) => topic.slug === slug)
}

/**
 * Toggle a category slug on or off.
 *
 * Root categories are independent. Sport chips require Sports to already be
 * selected; turning Sports off also clears every selected sport. Economía
 * beats follow the same rule under Economy.
 *
 * @param selected - Currently selected category slugs.
 * @param slug - Category slug being toggled.
 * @returns Updated selection (same array when a child add is blocked).
 */
export function toggleCategorySlug(selected: string[], slug: string): string[] {
  if (slug === SPORTS_CATEGORY_SLUG || slug === BUSINESS_CATEGORY_SLUG || slug === GOVERNMENT_CATEGORY_SLUG) {
    return toggleParentSlug(selected, slug)
  }
  if (isSportCategorySlug(slug)) {
    return toggleChildSlug(selected, slug, SPORTS_CATEGORY_SLUG)
  }
  if (isBusinessBeatSlug(slug)) {
    return toggleChildSlug(selected, slug, BUSINESS_CATEGORY_SLUG)
  }
  if (isGovernmentTopicSlug(slug)) {
    return toggleChildSlug(selected, slug, GOVERNMENT_CATEGORY_SLUG)
  }
  if (selected.includes(slug)) {
    return selected.filter((item) => item !== slug)
  }
  return [...selected, slug]
}

/**
 * Toggle a parent section and clear its children when turning it off.
 *
 * @param selected - Currently selected slugs.
 * @param parentSlug - Sports or Economy parent slug.
 * @returns Updated selection.
 */
function toggleParentSlug(selected: string[], parentSlug: string): string[] {
  const childSlugs = childSlugsForParent(parentSlug)
  if (selected.includes(parentSlug)) {
    return selected.filter((item) => item !== parentSlug && !childSlugs.has(item))
  }
  return [...selected, parentSlug]
}

/**
 * Toggle a child beat/sport only when its parent section is already selected.
 *
 * @param selected - Currently selected slugs.
 * @param slug - Child category slug.
 * @param parentSlug - Required parent slug.
 * @returns Updated selection, unchanged when the parent is off.
 */
function toggleChildSlug(selected: string[], slug: string, parentSlug: string): string[] {
  if (!selected.includes(parentSlug)) {
    return selected
  }
  if (selected.includes(slug)) {
    return selected.filter((item) => item !== slug)
  }
  return [...selected, slug]
}

/**
 * Child slugs that belong to a parent section chip.
 *
 * @param parentSlug - Sports or Economy.
 * @returns Child slug set for that parent.
 */
function childSlugsForParent(parentSlug: string): Set<string> {
  if (parentSlug === SPORTS_CATEGORY_SLUG) {
    return new Set(SPORT_CATEGORY_OPTIONS.map((sport) => sport.slug))
  }
  if (parentSlug === BUSINESS_CATEGORY_SLUG) {
    return new Set(BUSINESS_CATEGORY_OPTIONS.map((beat) => beat.slug))
  }
  if (parentSlug === GOVERNMENT_CATEGORY_SLUG) {
    return new Set(GOVERNMENT_CATEGORY_OPTIONS.map((topic) => topic.slug))
  }
  return new Set()
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
