import type { ICategoryOut } from '@/lib/api/category-client'
import {
  getCustomPageSections,
  listCustomTabs,
} from '@/lib/api/layout-client'
import { findCategoryBySlug } from '@/lib/helpers/category-selection'

/**
 * Load topic slugs configured for a custom tab page.
 *
 * @param pageName Custom tab slug.
 * @param marketCode Optional market code for the board.
 * @returns Ordered topic slugs.
 */
export async function loadCustomTabTopicSlugs(
  pageName: string,
  marketCode?: string | null,
): Promise<string[]> {
  const data = await getCustomPageSections(pageName, marketCode || 'pr', marketCode || 'pr')
  return data.items
    .filter((item) => item.section_type === 'topic')
    .map((item) => item.slug.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Resolve topic category rows for a custom tab parent selection.
 *
 * @param categories All categories.
 * @param topicSlugs Ordered topic slugs from the custom tab board.
 * @returns Matching category documents in board order.
 */
export function resolveCustomTabSubcategories(
  categories: ICategoryOut[],
  topicSlugs: string[],
): ICategoryOut[] {
  const bySlug = new Map(categories.map((category) => [category.slug, category]))
  return topicSlugs
    .map((slug) => bySlug.get(slug))
    .filter((category): category is ICategoryOut => category != null)
}

/**
 * List custom tab parent categories present in the taxonomy.
 *
 * @param categories All categories.
 * @returns Parent categories for registered custom tabs.
 */
export async function loadCustomTabParentCategories(
  categories: ICategoryOut[],
): Promise<Array<{ slug: string; label: string; category: ICategoryOut }>> {
  const tabs = await listCustomTabs().catch(() => [])
  return tabs
    .map((tab) => {
      const category = findCategoryBySlug(categories, tab.slug)
      if (!category) {
        return null
      }
      return { slug: tab.slug, label: tab.label, category }
    })
    .filter((row): row is { slug: string; label: string; category: ICategoryOut } => row != null)
}
