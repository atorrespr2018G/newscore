import type { ISlotOut } from '@/lib/api/layout-client'
import { resolveSlotPinnedLimit } from '@/lib/helpers/editor-placement-targets'
import { isShiftDownPlacementPositionKey } from '@/lib/helpers/feed-layout'
import {
  assignPinnedIdAtIndex,
  clearPinnedId,
  insertPinnedIdAtIndex,
  pinnedIdAtIndex,
  removePinnedIdAtIndex,
  swapPinnedIdsAtIndices,
} from '@/lib/helpers/pinned-ids'
import { slotForEditorPlacement } from '@/lib/helpers/slot-editor-pinned-ids'

/** Direction an editor can nudge a placed story within its slot. */
export type PlacementMoveDirectionType = 'up' | 'down'

export interface ISlotPinnedUpdate {
  slotId: string
  draftPinnedIds: string[]
}

export interface IPlacementMutationResult {
  updates: ISlotPinnedUpdate[]
  fromSlotId: string | null
  fromIndex: number | null
}

/**
 * Resolve the editor-view slot for a placement action.
 *
 * @param slots Current homepage slots.
 * @param slotId Slot id the action targets.
 * @returns Slot copy whose pinned_ids reflect staged draft pins.
 * @throws Error When the slot is missing or cannot hold articles.
 */
function resolveArticleSlot(slots: ISlotOut[], slotId: string): ISlotOut {
  const slot = slots.map((entry) => slotForEditorPlacement(entry)).find((entry) => entry.id === slotId)
  if (!slot) {
    throw new Error('Target slot was not found.')
  }
  if (slot.content_type !== 'articles') {
    throw new Error('Selected target cannot hold articles.')
  }
  return slot
}

/**
 * Build the patch set required to remove a story from a slot cell.
 *
 * @param slots Current homepage slots.
 * @param slotId Slot id holding the story.
 * @param index Zero-based cell index to clear.
 * @returns Single-slot update plus the cleared location metadata.
 * @throws Error When the cell is empty or the slot is invalid.
 */
export function buildRemovePlacementMutation(
  slots: ISlotOut[],
  slotId: string,
  index: number,
): IPlacementMutationResult {
  const slot = resolveArticleSlot(slots, slotId)
  if (pinnedIdAtIndex(slot.pinned_ids, index) === null) {
    throw new Error('There is no story to remove from this cell.')
  }
  return {
    updates: [{ slotId, draftPinnedIds: removePinnedIdAtIndex(slot.pinned_ids, index) }],
    fromSlotId: slotId,
    fromIndex: index,
  }
}

/**
 * Find the nearest occupied cell above or below an index, skipping blanks.
 *
 * @param pinnedIds Slot pinned article ids (may contain empty placeholders).
 * @param index Zero-based index of the story being moved.
 * @param direction Whether to scan upward or downward.
 * @returns Index of the nearest occupied neighbour, or null when none exists.
 */
function findAdjacentOccupiedIndex(
  pinnedIds: string[],
  index: number,
  direction: PlacementMoveDirectionType,
): number | null {
  const step = direction === 'up' ? -1 : 1
  for (let cursor = index + step; cursor >= 0 && cursor < pinnedIds.length; cursor += step) {
    if (pinnedIdAtIndex(pinnedIds, cursor) !== null) {
      return cursor
    }
  }
  return null
}

/**
 * Build the patch set required to nudge a story up or down within its slot.
 *
 * The story swaps with its nearest occupied neighbour (skipping empty cells) so
 * the reordered draft always resolves to a visibly different preview order.
 *
 * @param slots Current homepage slots.
 * @param slotId Slot id holding the story.
 * @param index Zero-based cell index of the story to move.
 * @param direction Whether to move the story up or down.
 * @returns Single-slot update plus the source location metadata.
 * @throws Error When the cell is empty or no neighbour exists in that direction.
 */
export function buildReorderPlacementMutation(
  slots: ISlotOut[],
  slotId: string,
  index: number,
  direction: PlacementMoveDirectionType,
): IPlacementMutationResult {
  const slot = resolveArticleSlot(slots, slotId)
  if (pinnedIdAtIndex(slot.pinned_ids, index) === null) {
    throw new Error('There is no story to move in this cell.')
  }
  const neighbourIndex = findAdjacentOccupiedIndex(slot.pinned_ids, index, direction)
  if (neighbourIndex === null) {
    throw new Error(
      direction === 'up' ? 'Story is already first in this slot.' : 'Story is already last in this slot.',
    )
  }
  return {
    updates: [
      { slotId, draftPinnedIds: swapPinnedIdsAtIndices(slot.pinned_ids, index, neighbourIndex) },
    ],
    fromSlotId: slotId,
    fromIndex: index,
  }
}

/**
 * Build the minimum patch set required to move an article into a target slot cell.
 *
 * @param slots Current homepage slots.
 * @param articleId Article id being placed.
 * @param targetSlotId Destination slot id.
 * @param targetIndex Zero-based destination index.
 * @param targetOccupantId Article id currently occupying the target cell, if any.
 * @returns Slot updates and previous location metadata.
 */
export function buildPlacementMutation(
  slots: ISlotOut[],
  articleId: string,
  targetSlotId: string,
  targetIndex: number,
  targetOccupantId: string | null = null,
): IPlacementMutationResult {
  const editorSlots = slots.map((slot) => slotForEditorPlacement(slot))
  const targetSlot = editorSlots.find((slot) => slot.id === targetSlotId)
  if (!targetSlot) {
    throw new Error('Target slot was not found.')
  }
  if (targetSlot.content_type !== 'articles') {
    throw new Error('Selected target cannot hold articles.')
  }

  let fromSlotId: string | null = null
  let fromIndex: number | null = null
  const updates: ISlotPinnedUpdate[] = []

  for (const slot of editorSlots) {
    const existingIndex = slot.pinned_ids.indexOf(articleId)
    if (existingIndex === -1) {
      continue
    }
    if (fromSlotId === null) {
      fromSlotId = slot.id
      fromIndex = existingIndex
    }
    updates.push({
      slotId: slot.id,
      draftPinnedIds: clearPinnedId(slot.pinned_ids, articleId),
    })
  }

  const targetBase = updates.find((update) => update.slotId === targetSlotId)?.draftPinnedIds ?? targetSlot.pinned_ids
  const pinnedLimit = resolveSlotPinnedLimit(targetSlot)
  const usesShiftDownPlacement = isShiftDownPlacementPositionKey(targetSlot.position_key)
  const nextTargetIds = usesShiftDownPlacement
    ? insertPinnedIdAtIndex(targetBase, articleId, targetIndex, pinnedLimit)
    : assignPinnedIdAtIndex(targetBase, articleId, targetIndex, targetOccupantId, pinnedLimit)
  const existingTarget = updates.find((update) => update.slotId === targetSlotId)
  if (existingTarget) {
    existingTarget.draftPinnedIds = nextTargetIds
  } else {
    updates.push({ slotId: targetSlotId, draftPinnedIds: nextTargetIds })
  }

  return { updates, fromSlotId, fromIndex }
}
