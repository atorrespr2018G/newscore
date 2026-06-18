import type { ISlotOut } from '@/lib/api/layout-client'
import { resolveSlotPinnedLimit } from '@/lib/helpers/editor-placement-targets'
import { isShiftDownPlacementPositionKey } from '@/lib/helpers/feed-layout'
import { assignPinnedIdAtIndex, clearPinnedId, insertPinnedIdAtIndex } from '@/lib/helpers/pinned-ids'
import { slotForEditorPlacement } from '@/lib/helpers/slot-editor-pinned-ids'

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
