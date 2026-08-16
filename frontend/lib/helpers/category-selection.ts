/** Editorial rule: a story belongs to at least one and at most three sections. */
export const MIN_CATEGORY_COUNT = 1
export const MAX_CATEGORY_COUNT = 3

/** Parent slug for per-sport subcategory chips in the editor/reporter. */
export const SPORTS_CATEGORY_SLUG = 'sports'

/** Parent slug for per-region subcategory chips in the editor/reporter. */
export const WORLD_CATEGORY_SLUG = 'world'

/** International potential is an optional 1-10 editorial relevance score. */
export const INTERNATIONAL_POTENTIAL_OPTIONS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface ICategoryRef {
  id: string
  slug: string
  parent_id: string | null
}

/**
 * Toggle a category id within the current selection, enforcing the max cap.
 *
 * @param selected Currently selected category ids.
 * @param categoryId Category id being toggled.
 * @returns Updated selection, unchanged when adding would exceed the cap.
 */
export function toggleCategory(selected: string[], categoryId: string): string[] {
  if (selected.includes(categoryId)) {
    return selected.filter((id) => id !== categoryId)
  }
  if (selected.length >= MAX_CATEGORY_COUNT) {
    return selected
  }
  return [...selected, categoryId]
}

/**
 * Whether a category is a top-level section (no parent).
 *
 * @param category Category row from the API.
 * @returns True when the category has no parent.
 */
export function isRootCategory(category: ICategoryRef): boolean {
  return category.parent_id == null || category.parent_id === ''
}

/**
 * Top-level categories shown as primary section chips.
 *
 * @param categories Full category list.
 * @returns Root categories only.
 */
export function rootCategories<T extends ICategoryRef>(categories: T[]): T[] {
  return categories.filter(isRootCategory)
}

/**
 * Child categories under a parent id (e.g. sports under Sports).
 *
 * @param categories Full category list.
 * @param parentId Parent category id.
 * @returns Ordered children of that parent.
 */
export function childCategories<T extends ICategoryRef>(categories: T[], parentId: string): T[] {
  return categories.filter((category) => category.parent_id === parentId)
}

/**
 * Find a category by slug.
 *
 * @param categories Full category list.
 * @param slug Category slug such as `sports`.
 * @returns Matching category, or undefined.
 */
export function findCategoryBySlug<T extends ICategoryRef>(
  categories: T[],
  slug: string,
): T | undefined {
  const normalized = slug.trim().toLowerCase()
  return categories.find((category) => category.slug.trim().toLowerCase() === normalized)
}

/**
 * Toggle a root section chip. Unchecking a parent also clears its children.
 *
 * @param selected Currently selected category ids.
 * @param categoryId Root category id being toggled.
 * @param categories Full category list for child lookup.
 * @param extraChildIds Optional extra child ids to clear (e.g. Sports-page sports).
 * @returns Updated selection.
 */
export function toggleRootCategory(
  selected: string[],
  categoryId: string,
  categories: ICategoryRef[],
  extraChildIds: string[] = [],
): string[] {
  if (selected.includes(categoryId)) {
    const childIds = new Set([
      ...categories
        .filter((category) => category.parent_id === categoryId)
        .map((category) => category.id),
      ...extraChildIds,
    ])
    return selected.filter((id) => id !== categoryId && !childIds.has(id))
  }
  return toggleCategory(selected, categoryId)
}
