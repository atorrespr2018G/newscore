import type { ICategoryOut } from '@/lib/api/category-client'
import {
  BUSINESS_CATEGORY_SLUG,
  childCategories,
  findCategoryBySlug,
} from '@/lib/helpers/category-selection'

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
 * Resolve Economía beat chips in archive order, then any extra children.
 *
 * @param categories Full category catalog.
 * @returns Beat categories under Economy.
 */
export function resolveBusinessSubcategories(categories: ICategoryOut[]): ICategoryOut[] {
  const parent = findCategoryBySlug(categories, BUSINESS_CATEGORY_SLUG)
  if (!parent) {
    return []
  }
  const bySlug = new Map(
    categories.map((category) => [category.slug.trim().toLowerCase(), category] as const),
  )
  const ordered: ICategoryOut[] = []
  const seen = new Set<string>()
  for (const slug of BUSINESS_BEAT_SLUGS) {
    const category = bySlug.get(slug)
    if (!category || seen.has(category.id)) {
      continue
    }
    seen.add(category.id)
    ordered.push(category)
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
