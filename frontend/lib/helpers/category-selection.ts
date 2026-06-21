/** Editorial rule: a story belongs to at least one and at most three sections. */
export const MIN_CATEGORY_COUNT = 1
export const MAX_CATEGORY_COUNT = 3

/** International potential is an optional 1-10 editorial relevance score. */
export const INTERNATIONAL_POTENTIAL_OPTIONS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

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
