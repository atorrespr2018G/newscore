/** Sentinel value for an intentionally empty editor placement cell. */
export const PINNED_ID_EMPTY = ''

/**
 * Read the article id occupying a pinned index, treating blanks as empty.
 *
 * @param pinnedIds Slot pinned ids, possibly containing empty placeholders.
 * @param index Zero-based slot cell index.
 * @returns Occupying article id or null when the cell is empty.
 */
export function pinnedIdAtIndex(pinnedIds: string[], index: number): string | null {
  const articleId = pinnedIds[index]
  if (!articleId || !articleId.trim()) {
    return null
  }
  return articleId
}

/**
 * Remove an article id from a slot while preserving other cell indexes.
 *
 * @param pinnedIds Current pinned article ids.
 * @param articleId Article id to clear from the slot.
 * @returns Updated pinned id list with index positions preserved.
 */
export function clearPinnedId(pinnedIds: string[], articleId: string): string[] {
  return pinnedIds.map((id) => (id === articleId ? PINNED_ID_EMPTY : id))
}

/**
 * Trim trailing empty placeholders before persisting pinned ids.
 *
 * @param pinnedIds Candidate pinned id list.
 * @returns Normalized list safe for API persistence.
 */
export function normalizePinnedIdsForSave(pinnedIds: string[]): string[] {
  let end = pinnedIds.length
  while (end > 0) {
    const candidate = pinnedIds[end - 1]
    if (candidate && candidate.trim()) {
      break
    }
    end -= 1
  }
  return pinnedIds.slice(0, end)
}

/**
 * Cap pinned ids to a slot capacity, evicting trailing stories when full.
 *
 * @param pinnedIds Candidate pinned id list.
 * @param maxLength Maximum allowed pinned ids, or null when unbounded.
 * @returns Pinned ids trimmed to the slot capacity.
 */
function clampPinnedIdsToMaxLength(pinnedIds: string[], maxLength: number | null): string[] {
  if (maxLength == null || maxLength <= 0 || pinnedIds.length <= maxLength) {
    return pinnedIds
  }
  return pinnedIds.slice(0, maxLength)
}

/**
 * Insert an article id at a landing index and shift remaining ids down.
 *
 * @param pinnedIds Current pinned article ids.
 * @param articleId Article id to place.
 * @param targetIndex Zero-based landing index.
 * @param maxLength Optional slot capacity; overflow evicts trailing stories.
 * @returns Updated pinned id list with insertion semantics applied.
 */
export function insertPinnedIdAtIndex(
  pinnedIds: string[],
  articleId: string,
  targetIndex: number,
  maxLength: number | null = null,
): string[] {
  const withoutArticle = clearPinnedId(pinnedIds, articleId)
  const next = [...withoutArticle]
  while (next.length <= targetIndex) {
    next.push(PINNED_ID_EMPTY)
  }
  next.splice(targetIndex, 0, articleId)
  return normalizePinnedIdsForSave(clampPinnedIdsToMaxLength(next, maxLength))
}

/**
 * Place an article in a slot cell using direct write or insert semantics.
 *
 * Empty targets write to the requested index, padding leading cells when
 * needed. Occupied targets insert the incoming story at the landing index so
 * the displaced occupant and every later story shift down one position.
 *
 * @param pinnedIds Current pinned article ids.
 * @param articleId Article id to place.
 * @param targetIndex Zero-based landing index.
 * @param targetOccupantId Article id currently occupying the target, if any.
 * @param maxLength Optional slot capacity; overflow evicts trailing stories.
 * @returns Updated pinned id list.
 */
export function assignPinnedIdAtIndex(
  pinnedIds: string[],
  articleId: string,
  targetIndex: number,
  targetOccupantId: string | null,
  maxLength: number | null = null,
): string[] {
  if (targetOccupantId != null) {
    return insertPinnedIdAtIndex(pinnedIds, articleId, targetIndex, maxLength)
  }

  const withoutArticle = clearPinnedId(pinnedIds, articleId)
  const next = [...withoutArticle]
  while (next.length <= targetIndex) {
    next.push(PINNED_ID_EMPTY)
  }
  next[targetIndex] = articleId
  return normalizePinnedIdsForSave(clampPinnedIdsToMaxLength(next, maxLength))
}
