import type { ISlotOut } from '@/lib/api/layout-client'

/**
 * Resolve the pinned ids editors should read and mutate in the workspace.
 *
 * @param slot Slot payload from layout admin API.
 * @returns Staged draft pins when present; otherwise live pins.
 */
export function editorPinnedIds(slot: ISlotOut): string[] {
  return slot.draft_pinned_ids ?? slot.pinned_ids
}

/**
 * Check whether a slot has unpublished placement changes.
 *
 * @param slot Slot payload from layout admin API.
 * @returns True when staged draft pins differ from live pins.
 */
export function slotHasUnpublishedPlacementChanges(slot: ISlotOut): boolean {
  if (slot.draft_pinned_ids == null) {
    return false
  }
  return JSON.stringify(slot.draft_pinned_ids) !== JSON.stringify(slot.pinned_ids)
}

/**
 * Check whether any slot in a layout has unpublished placement changes.
 *
 * @param slots Homepage slots from layout admin API.
 * @returns True when at least one slot has staged draft pins.
 */
export function layoutHasUnpublishedPlacementChanges(slots: ISlotOut[]): boolean {
  return slots.some((slot) => slotHasUnpublishedPlacementChanges(slot))
}

/**
 * Build a slot view for editor placement helpers using staged pins.
 *
 * @param slot Slot payload from layout admin API.
 * @returns Slot copy whose pinned_ids reflect the editor workspace.
 */
export function slotForEditorPlacement(slot: ISlotOut): ISlotOut {
  return {
    ...slot,
    pinned_ids: editorPinnedIds(slot),
  }
}
