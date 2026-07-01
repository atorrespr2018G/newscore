import type { ISlotOut } from '@/lib/api/layout-client'
import { editorPinnedIds } from '@/lib/helpers/slot-editor-pinned-ids'

/**
 * Resolve article ids newly staged into a single slot (draft minus live pins).
 *
 * An id counts as locally newly placed when it appears in ``draft_pinned_ids``
 * but not in live ``pinned_ids``, so the highlight clears automatically on publish.
 *
 * @param slot Slot payload carrying draft and live pin arrays.
 * @returns Set of article ids added to this slot since the last publish.
 */
export function computeLocalNewlyPlacedIds(slot: ISlotOut): Set<string> {
  const draftIds = slot.draft_pinned_ids
  if (draftIds == null) {
    return new Set<string>()
  }
  const publishedIds = new Set(slot.pinned_ids)
  const newlyPlaced = new Set<string>()
  for (const id of draftIds) {
    if (id && id.trim() && !publishedIds.has(id)) {
      newlyPlaced.add(id)
    }
  }
  return newlyPlaced
}

/**
 * Collect staged pin ids for a slot, dropping empty placeholders.
 *
 * @param slot Homepage slot carrying draft or live pins.
 * @returns Non-empty article ids currently staged in the slot.
 */
function collectStagedPinIds(slot: ISlotOut): string[] {
  return editorPinnedIds(slot).filter((id) => Boolean(id && id.trim()))
}

/**
 * Build the per-slot "newly placed" highlight map for the placement canvas.
 *
 * Starts from each slot's local draft-minus-live ids, then propagates any
 * globally-new id to every slot where that story is staged. This ensures hero /
 * top-stories cascade pins surface the same indicator on matching category
 * sections, even when the story was already live in those slots.
 *
 * @param homepageSlots Homepage slots carrying staged draft pins.
 * @returns Slot-id keyed sets of article ids to ring; empty slots are omitted.
 */
export function buildNewlyPlacedIdsBySlotId(homepageSlots: ISlotOut[]): Map<string, Set<string>> {
  const localBySlotId = new Map<string, Set<string>>()
  const globalNewlyPlacedIds = new Set<string>()

  for (const slot of homepageSlots) {
    const localIds = computeLocalNewlyPlacedIds(slot)
    localBySlotId.set(slot.id, localIds)
    for (const id of localIds) {
      globalNewlyPlacedIds.add(id)
    }
  }

  if (globalNewlyPlacedIds.size === 0) {
    return new Map<string, Set<string>>()
  }

  const highlightBySlotId = new Map<string, Set<string>>()
  for (const slot of homepageSlots) {
    const highlighted = new Set(localBySlotId.get(slot.id) ?? [])
    for (const id of collectStagedPinIds(slot)) {
      if (globalNewlyPlacedIds.has(id)) {
        highlighted.add(id)
      }
    }
    if (highlighted.size > 0) {
      highlightBySlotId.set(slot.id, highlighted)
    }
  }
  return highlightBySlotId
}
