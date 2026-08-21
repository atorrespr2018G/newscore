import type { ICategoryOut } from '@/lib/api/category-client'
import { getHealthPageSections } from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS } from '@/lib/editor/editor-scope'
import {
  HEALTH_CATEGORY_SLUG,
  childCategories,
  findCategoryBySlug,
} from '@/lib/helpers/category-selection'
import { US_MARKET_CODE } from '@/lib/us-states'

/** Default US state region used when discovering Health topic slugs. */
const DEFAULT_US_HEALTH_REGION_CODE = 'us-fl'

/** Ordered Health topic slugs matching the public `/health/[slug]` archives. */
export const HEALTH_TOPIC_SLUGS = [
  'fitness',
  'food',
  'sleep',
  'family',
] as const

const HEALTH_TOPIC_SLUG_SET = new Set<string>(HEALTH_TOPIC_SLUGS)

/**
 * Load ordered Health topic slugs for one market or every editor market.
 *
 * @param marketCode Optional single market; otherwise all editor markets.
 * @param regionCode Optional region code such as `us-fl`.
 * @returns Deduplicated topic slugs in first-seen order.
 */
export async function loadHealthTopicSlugs(
  marketCode?: string,
  regionCode?: string | null,
): Promise<string[]> {
  const markets = marketCode ? [marketCode] : [...EDITOR_MARKET_OPTIONS]
  const lists = await Promise.all(
    markets.map((code) => {
      const resolvedRegion =
        regionCode ?? (code === US_MARKET_CODE ? DEFAULT_US_HEALTH_REGION_CODE : null)
      return getHealthPageSections(code, resolvedRegion)
    }),
  )
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const list of lists) {
    for (const item of list.items) {
      if (item.section_type !== 'health') {
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
 * Whether a category is an Health topic rather than the Health parent.
 *
 * @param categories Full category catalog.
 * @param category Candidate category.
 * @returns True when the row should stay off the root chip list.
 */
export function isHealthTopicCategory(
  categories: ICategoryOut[],
  category: ICategoryOut,
): boolean {
  const parent = findCategoryBySlug(categories, HEALTH_CATEGORY_SLUG)
  const slug = category.slug.trim().toLowerCase()
  if (slug === HEALTH_CATEGORY_SLUG) {
    return false
  }
  if (HEALTH_TOPIC_SLUG_SET.has(slug)) {
    return true
  }
  return parent != null && category.parent_id === parent.id
}

/**
 * Resolve Health topic chips from the configured list, then extra children.
 *
 * @param categories Full category catalog.
 * @param topicSlugs Ordered slugs from health-page-sections (may be empty).
 * @returns Categories to show under the Health subcategory.
 */
export function resolveHealthSubcategories(
  categories: ICategoryOut[],
  topicSlugs: string[],
): ICategoryOut[] {
  const parent = findCategoryBySlug(categories, HEALTH_CATEGORY_SLUG)
  const bySlug = new Map(
    categories.map((category) => [category.slug.trim().toLowerCase(), category] as const),
  )
  const ordered: ICategoryOut[] = []
  const seen = new Set<string>()
  const preferred = topicSlugs.length > 0 ? topicSlugs : [...HEALTH_TOPIC_SLUGS]
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
