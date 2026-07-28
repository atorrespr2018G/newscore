import type { ICategoryOut } from '@/lib/api/category-client'
import { getSportsPageSections } from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS } from '@/lib/editor/editor-scope'
import {
  SPORTS_CATEGORY_SLUG,
  findCategoryBySlug,
  rootCategories,
} from '@/lib/helpers/category-selection'

/**
 * Load ordered sport slugs for one market or every editor market.
 *
 * @param marketCode Optional single market; otherwise all editor markets.
 * @returns Deduplicated sport slugs in first-seen order.
 */
export async function loadSportSlugs(marketCode?: string): Promise<string[]> {
  const markets = marketCode ? [marketCode] : [...EDITOR_MARKET_OPTIONS]
  const lists = await Promise.all(markets.map((code) => getSportsPageSections(code)))
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const list of lists) {
    for (const item of list.items) {
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
 * Resolve sport subcategory options from the Sports list + category catalog.
 *
 * Prefers Sports-page section order; falls back to categories parented under Sports.
 *
 * @param categories Full category catalog.
 * @param sportSlugs Ordered slugs from sports-page-sections (may be empty).
 * @returns Categories to show under the Sport subcategory.
 */
export function resolveSportSubcategories(
  categories: ICategoryOut[],
  sportSlugs: string[],
): ICategoryOut[] {
  if (sportSlugs.length > 0) {
    const bySlug = new Map(
      categories.map((category) => [category.slug.trim().toLowerCase(), category] as const),
    )
    const resolved: ICategoryOut[] = []
    for (const slug of sportSlugs) {
      const category = bySlug.get(slug.trim().toLowerCase())
      if (category) {
        resolved.push(category)
      }
    }
    return resolved
  }

  const sportsParent = findCategoryBySlug(categories, SPORTS_CATEGORY_SLUG)
  if (!sportsParent) {
    return []
  }
  return categories.filter((category) => category.parent_id === sportsParent.id)
}

/**
 * Top-level filter/taxonomy categories, excluding individual sports.
 *
 * @param categories Full category catalog.
 * @param sportSlugs Known sport slugs to hide from the root list.
 * @returns Root section categories for primary pickers.
 */
export function rootSectionCategories(
  categories: ICategoryOut[],
  sportSlugs: string[],
): ICategoryOut[] {
  const sportSlugSet = new Set(sportSlugs.map((slug) => slug.trim().toLowerCase()))
  const sportsParent = findCategoryBySlug(categories, SPORTS_CATEGORY_SLUG)
  return rootCategories(categories).filter((category) => {
    if (category.slug.trim().toLowerCase() === SPORTS_CATEGORY_SLUG) {
      return true
    }
    if (sportSlugSet.has(category.slug.trim().toLowerCase())) {
      return false
    }
    if (sportsParent && category.parent_id === sportsParent.id) {
      return false
    }
    return true
  })
}

/**
 * Category id to send to search: specific sport when set, otherwise section.
 *
 * @param filters Category and optional sport filter ids.
 * @returns Effective category id for the search API.
 */
export function effectiveSearchCategoryId(filters: {
  categoryId: string
  sportCategoryId: string
}): string {
  const sportId = filters.sportCategoryId.trim()
  if (sportId) {
    return sportId
  }
  return filters.categoryId.trim()
}
