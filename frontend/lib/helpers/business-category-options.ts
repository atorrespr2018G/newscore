import type { ICategoryOut } from '@/lib/api/category-client'
import { getBusinessPageSections } from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS } from '@/lib/editor/editor-scope'
import {
  BUSINESS_CATEGORY_SLUG,
  childCategories,
  findCategoryBySlug,
} from '@/lib/helpers/category-selection'
import { US_MARKET_CODE } from '@/lib/us-states'

/** Default US state region used when discovering Business beat slugs. */
const DEFAULT_US_BUSINESS_REGION_CODE = 'us-fl'

/** Ordered Economía beat slugs matching the public `/business/[slug]` archives. */
export const BUSINESS_BEAT_SLUGS = [
  'economy',
  'companies',
  'banking',
  'autos',
  'tourism',
  'construction',
  'agriculture',
] as const

const BUSINESS_BEAT_SLUG_SET = new Set<string>(BUSINESS_BEAT_SLUGS)

/**
 * Load ordered Business beat slugs for one market or every editor market.
 *
 * @param marketCode Optional single market; otherwise all editor markets.
 * @param regionCode Optional region code such as `us-fl`.
 * @returns Deduplicated beat slugs in first-seen order.
 */
export async function loadBusinessTopicSlugs(
  marketCode?: string,
  regionCode?: string | null,
): Promise<string[]> {
  const markets = marketCode ? [marketCode] : [...EDITOR_MARKET_OPTIONS]
  const lists = await Promise.all(
    markets.map((code) => {
      const resolvedRegion =
        regionCode ?? (code === US_MARKET_CODE ? DEFAULT_US_BUSINESS_REGION_CODE : null)
      return getBusinessPageSections(code, resolvedRegion)
    }),
  )
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const list of lists) {
    for (const item of list.items) {
      if (item.section_type !== 'business') {
        continue
      }
      const slug = item.slug.trim().toLowerCase()
      if (!slug || seen.has(slug)) {
        continue
      }
      seen.add(slug)
      slugs.push(item.slug)
    }
  }
  return slugs
}

/**
 * Whether a category is an Economía beat rather than the Economy parent.
 *
 * @param categories Full category catalog.
 * @param category Candidate category.
 * @returns True when the row should stay off the root chip list.
 */
export function isBusinessBeatCategory(
  categories: ICategoryOut[],
  category: ICategoryOut,
): boolean {
  const parent = findCategoryBySlug(categories, BUSINESS_CATEGORY_SLUG)
  const slug = category.slug.trim().toLowerCase()
  if (slug === BUSINESS_CATEGORY_SLUG) {
    return false
  }
  if (BUSINESS_BEAT_SLUG_SET.has(slug)) {
    return true
  }
  return parent != null && category.parent_id === parent.id
}

/**
 * Resolve Economía beat chips from the configured list, then any extra children.
 *
 * @param categories Full category catalog.
 * @param topicSlugs Ordered slugs from business-page-sections (may be empty).
 * @returns Beat categories under Economy.
 */
export function resolveBusinessSubcategories(
  categories: ICategoryOut[],
  topicSlugs: string[] = [],
): ICategoryOut[] {
  const parent = findCategoryBySlug(categories, BUSINESS_CATEGORY_SLUG)
  const bySlug = new Map(
    categories.map((category) => [category.slug.trim().toLowerCase(), category] as const),
  )
  const ordered: ICategoryOut[] = []
  const seen = new Set<string>()
  const preferred = topicSlugs.length > 0 ? topicSlugs : [...BUSINESS_BEAT_SLUGS]
  for (const slug of preferred) {
    const category = bySlug.get(slug.trim().toLowerCase())
    if (!category || seen.has(category.id)) {
      continue
    }
    seen.add(category.id)
    ordered.push(category)
  }
  if (!parent) {
    return ordered
  }
  for (const child of childCategories(categories, parent.id)) {
    if (seen.has(child.id)) {
      continue
    }
    seen.add(child.id)
    ordered.push(child)
  }
  return ordered
}
