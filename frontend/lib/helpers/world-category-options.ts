import type { ICategoryOut } from '@/lib/api/category-client'
import { getWorldPageSections, type IWorldPageSectionItem } from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS } from '@/lib/editor/editor-scope'
import { findCategoryBySlug } from '@/lib/helpers/category-selection'
import { worldRegionCategorySlug } from '@/lib/helpers/world-archive'
import { US_MARKET_CODE } from '@/lib/us-states'

/** Default US state region used when discovering World region slugs. */
const DEFAULT_US_WORLD_REGION_CODE = 'us-fl'

/** World section types that have a public region archive. */
const WORLD_REGION_SECTION_TYPES = new Set([
  'more_top_stories',
  'spotlight',
  'rail',
  'category',
])

/**
 * Category slug for a World-page region row, or null for hero/live/ads.
 *
 * @param item Typed World section row.
 * @returns Category slug such as `europe`, or null when not a region.
 */
export function worldRegionCategorySlugFromSection(
  item: IWorldPageSectionItem,
): string | null {
  if (!WORLD_REGION_SECTION_TYPES.has(item.section_type)) {
    return null
  }
  const slug = item.slug.trim().toLowerCase()
  if (!slug) {
    return null
  }
  return worldRegionCategorySlug(slug)
}

/**
 * Load ordered World region category slugs for one market or every editor market.
 *
 * @param marketCode Optional single market; otherwise all editor markets.
 * @param regionCode Optional region code such as `us-fl`.
 * @returns Deduplicated region category slugs in first-seen order.
 */
export async function loadWorldRegionSlugs(
  marketCode?: string,
  regionCode?: string | null,
): Promise<string[]> {
  const markets = marketCode ? [marketCode] : [...EDITOR_MARKET_OPTIONS]
  const lists = await Promise.all(
    markets.map((code) => {
      const resolvedRegion =
        regionCode ?? (code === US_MARKET_CODE ? DEFAULT_US_WORLD_REGION_CODE : null)
      return getWorldPageSections(code, resolvedRegion)
    }),
  )
  return uniqueWorldRegionSlugs(lists.flatMap((list) => list.items))
}

/**
 * Deduplicate region category slugs from World section rows.
 *
 * @param items World-page section items.
 * @returns Unique category slugs in first-seen order.
 */
function uniqueWorldRegionSlugs(items: IWorldPageSectionItem[]): string[] {
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const item of items) {
    const slug = worldRegionCategorySlugFromSection(item)
    if (!slug || seen.has(slug)) {
      continue
    }
    seen.add(slug)
    slugs.push(slug)
  }
  return slugs
}

/**
 * Resolve World region subcategory options from the World list + category catalog.
 *
 * @param categories Full category catalog.
 * @param regionSlugs Ordered slugs from world-page-sections.
 * @returns Categories to show under the World subcategory.
 */
export function resolveWorldRegionSubcategories(
  categories: ICategoryOut[],
  regionSlugs: string[],
): ICategoryOut[] {
  const bySlug = new Map(
    categories.map((category) => [category.slug.trim().toLowerCase(), category] as const),
  )
  const resolved: ICategoryOut[] = []
  for (const slug of regionSlugs) {
    const category = bySlug.get(slug.trim().toLowerCase())
    if (category) {
      resolved.push(category)
    }
  }
  return resolved
}

/**
 * Hide World region rows from the root category chip list.
 *
 * @param categories Full category catalog.
 * @param worldRegionSlugs Known region slugs to hide from the root list.
 * @param category Candidate root category.
 * @returns True when the category should stay in the root picker.
 */
export function isRootWorldSectionCategory(
  categories: ICategoryOut[],
  worldRegionSlugs: string[],
  category: ICategoryOut,
): boolean {
  const worldParent = findCategoryBySlug(categories, 'world')
  const slug = category.slug.trim().toLowerCase()
  if (slug === 'world') {
    return true
  }
  if (worldRegionSlugs.some((regionSlug) => regionSlug.trim().toLowerCase() === slug)) {
    return false
  }
  if (worldParent && category.parent_id === worldParent.id) {
    return false
  }
  return true
}
