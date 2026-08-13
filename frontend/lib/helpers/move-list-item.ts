/**
 * Move one list item from one index to another.
 *
 * @param items - Source list.
 * @param fromIndex - Index of the item being moved.
 * @param toIndex - Destination index after removal.
 * @returns A new list with the item relocated, or the same list when invalid.
 */
export function moveListItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}
