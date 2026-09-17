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
 * Resolve the excluded ids editors should read and mutate in the workspace.
 *
 * @param slot Slot payload from layout admin API.
 * @returns Staged draft exclusions when present; otherwise live exclusions.
 */
export function editorExcludedIds(slot: ISlotOut): string[] {
  return slot.draft_excluded_ids ?? slot.excluded_ids ?? []
}

/**
 * Check whether a slot has unpublished pin changes.
 *
 * @param slot Slot payload from layout admin API.
 * @returns True when staged draft pins differ from live pins.
 */
function slotHasUnpublishedPinChanges(slot: ISlotOut): boolean {
  if (slot.draft_pinned_ids == null) {
    return false
  }
  return JSON.stringify(slot.draft_pinned_ids) !== JSON.stringify(slot.pinned_ids)
}

/**
 * Check whether a slot has unpublished exclusion changes.
 *
 * @param slot Slot payload from layout admin API.
 * @returns True when staged draft exclusions differ from live exclusions.
 */
function slotHasUnpublishedExclusionChanges(slot: ISlotOut): boolean {
  if (slot.draft_excluded_ids == null) {
    return false
  }
  return JSON.stringify(slot.draft_excluded_ids) !== JSON.stringify(slot.excluded_ids ?? [])
}

/**
 * Check whether a slot has unpublished placement changes.
 *
 * @param slot Slot payload from layout admin API.
 * @returns True when staged pins or exclusions differ from live values.
 */
export function slotHasUnpublishedPlacementChanges(slot: ISlotOut): boolean {
  return slotHasUnpublishedPinChanges(slot) || slotHasUnpublishedExclusionChanges(slot)
}

/**
 * Check whether any slot in a layout has unpublished placement changes.
 *
 * @param slots Homepage slots from layout admin API.
 * @returns True when at least one slot has staged draft pins or exclusions.
 */
export function layoutHasUnpublishedPlacementChanges(slots: ISlotOut[]): boolean {
  return slots.some((slot) => slotHasUnpublishedPlacementChanges(slot))
}

/**
 * Build a slot view for editor placement helpers using staged pins/exclusions.
 *
 * @param slot Slot payload from layout admin API.
 * @returns Slot copy whose pinned/excluded ids reflect the editor workspace.
 */
export function slotForEditorPlacement(slot: ISlotOut): ISlotOut {
  return {
    ...slot,
    pinned_ids: editorPinnedIds(slot),
    excluded_ids: editorExcludedIds(slot),
  }
}
