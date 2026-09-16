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
 * Trim pins to capacity while keeping worldwide stories when possible.
 *
 * @param pinnedIds Candidate pinned ids.
 * @param maxLength Slot capacity.
 * @param worldwideIds Known worldwide article ids.
 * @param protectedId Worldwide article that must remain when provided.
 * @returns Clamped pin list.
 */
export function clampPinnedIdsPreservingGlobals(
  pinnedIds: string[],
  maxLength: number | null,
  worldwideIds: ReadonlySet<string>,
  protectedId = '',
): string[] {
  if (maxLength == null || maxLength <= 0 || pinnedIds.length <= maxLength) {
    return pinnedIds
  }
  const next = [...pinnedIds]
  const keepId = protectedId.trim()
  while (next.length > maxLength) {
    let removed = false
    for (let index = next.length - 1; index >= 0; index -= 1) {
      const pin = next[index]?.trim() ?? ''
      if (!pin) {
        next.splice(index, 1)
        removed = true
        break
      }
      if (pin === keepId) {
        continue
      }
      if (!worldwideIds.has(pin)) {
        next.splice(index, 1)
        removed = true
        break
      }
    }
    if (removed) {
      continue
    }
    for (let index = next.length - 1; index >= 0; index -= 1) {
      if ((next[index]?.trim() ?? '') !== keepId) {
        next.splice(index, 1)
        removed = true
        break
      }
    }
    if (!removed) {
      break
    }
  }
  return next
}

/**
 * Insert a worldwide story at the requested index, shifting others down.
 *
 * @param pinnedIds Current pinned ids.
 * @param articleId Worldwide article id.
 * @param targetIndex Preferred zero-based index.
 * @param worldwideIds Known worldwide ids in the slot.
 * @param maxLength Optional capacity.
 * @returns Updated pins.
 */
export function placeWorldwidePinnedIdAtIndex(
  pinnedIds: string[],
  articleId: string,
  targetIndex: number,
  worldwideIds: ReadonlySet<string> = new Set(),
  maxLength: number | null = null,
): string[] {
  const withoutArticle = clearPinnedId(pinnedIds, articleId)
  const next = [...withoutArticle]
  while (next.length <= targetIndex) {
    next.push(PINNED_ID_EMPTY)
  }
  next.splice(targetIndex, 0, articleId)
  const globals = new Set(worldwideIds)
  globals.add(articleId)
  return normalizePinnedIdsForSave(
    clampPinnedIdsPreservingGlobals(next, maxLength, globals, articleId),
  )
}

/**
 * Place a local story without overwriting worldwide pins.
 *
 * @param pinnedIds Current pinned ids.
 * @param articleId Local article id.
 * @param targetIndex Preferred zero-based index.
 * @param worldwideIds Known worldwide ids in the slot.
 * @param maxLength Optional capacity.
 * @returns Updated pins.
 */
export function placeLocalPinnedIdAvoidingGlobals(
  pinnedIds: string[],
  articleId: string,
  targetIndex: number,
  worldwideIds: ReadonlySet<string>,
  maxLength: number | null = null,
): string[] {
  const withoutArticle = clearPinnedId(pinnedIds, articleId)
  const next = [...withoutArticle]
  let index = Math.max(0, targetIndex)
  while (true) {
    while (next.length <= index) {
      next.push(PINNED_ID_EMPTY)
    }
    const occupant = next[index]?.trim() ?? ''
    if (!occupant || !worldwideIds.has(occupant)) {
      break
    }
    index += 1
  }
  const occupant = next[index]?.trim() ?? ''
  if (occupant && !worldwideIds.has(occupant)) {
    next.splice(index, 0, articleId)
  } else {
    next[index] = articleId
  }
  return normalizePinnedIdsForSave(
    clampPinnedIdsPreservingGlobals(next, maxLength, worldwideIds, ''),
  )
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
 * Clear the article occupying a slot cell, preserving earlier index positions.
 *
 * @param pinnedIds Current pinned article ids.
 * @param index Zero-based slot cell index to clear.
 * @returns Updated pinned id list with trailing blanks trimmed.
 */
export function removePinnedIdAtIndex(pinnedIds: string[], index: number): string[] {
  if (index < 0 || index >= pinnedIds.length) {
    return normalizePinnedIdsForSave([...pinnedIds])
  }
  const next = [...pinnedIds]
  next[index] = PINNED_ID_EMPTY
  return normalizePinnedIdsForSave(next)
}

/**
 * Swap the article ids occupying two slot cells, padding gaps as needed.
 *
 * @param pinnedIds Current pinned article ids.
 * @param indexA First zero-based slot cell index.
 * @param indexB Second zero-based slot cell index.
 * @returns Updated pinned id list with the two cells swapped.
 * @throws Error When either index is negative.
 */
export function swapPinnedIdsAtIndices(
  pinnedIds: string[],
  indexA: number,
  indexB: number,
): string[] {
  if (indexA < 0 || indexB < 0) {
    throw new Error('Cannot swap slot cells outside the slot bounds.')
  }
  const next = [...pinnedIds]
  const highestIndex = Math.max(indexA, indexB)
  while (next.length <= highestIndex) {
    next.push(PINNED_ID_EMPTY)
  }
  ;[next[indexA], next[indexB]] = [next[indexB], next[indexA]]
  return normalizePinnedIdsForSave(next)
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
