import type { ISlotOut } from '@/lib/api/layout-client'
import {
  HERO_PINNED_LIMIT,
  isMoreTopStoriesPositionKey,
  MORE_TOP_STORIES_PINNED_LIMIT,
  US_FEATURED_PINNED_LIMIT,
} from '@/lib/helpers/feed-layout'
import { pinnedIdAtIndex } from '@/lib/helpers/pinned-ids'
import { editorPinnedIds, slotForEditorPlacement } from '@/lib/helpers/slot-editor-pinned-ids'
import { homepageSectionTitle, staticSectionLabelTranslator } from '@/lib/helpers/section-labels'
import { moduleKindForPresentation } from '@/lib/presentation-registry'

const DEFAULT_PRESENTATION_TYPE = 'grid_4'
const DEFAULT_TARGET_COUNT = 1

/** Homepage slot order in the editor canvas (matches public homepage layout). */
const HOMEPAGE_EDITOR_SLOT_ORDER: readonly string[] = [
  'hero',
  'us-featured',
  'more-top-stories',
  'midterm-elections',
  'editorial-rail',
  'politics',
  'sports',
  'health',
  'finance',
  'entertainment',
  'world',
  'technology',
  'business',
  'more-top-stories-2',
  'midterm-elections-2',
  'editorial-rail-2',
  'us',
  'style',
  'travel',
]

const HOMEPAGE_EDITOR_SLOT_ORDER_INDEX = new Map(
  HOMEPAGE_EDITOR_SLOT_ORDER.map((positionKey, index) => [positionKey, index]),
)

export interface IPlacementTarget {
  slotId: string
  slotLabel: string
  positionKey: string
  contentType: string
  presentationType: string
  moduleKind: string
  index: number
  articleId: string | null
}

/**
 * Parse a positive slot limit from query-rule metadata.
 *
 * @param value Raw limit value from API payloads.
 * @returns Positive integer limit or null when invalid.
 */
function parsePositiveLimit(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed)
    }
  }
  return null
}

/**
 * Resolve the maximum number of pinned articles a slot can hold.
 *
 * @param slot Homepage slot metadata.
 * @returns Slot capacity from query rules, or null when unbounded.
 */
export function resolveSlotPinnedLimit(slot: ISlotOut): number | null {
  const fromQueryRule = parsePositiveLimit(slot.query_rule?.limit)
  if (fromQueryRule != null) {
    return fromQueryRule
  }

  if (slot.position_key === 'hero') {
    return HERO_PINNED_LIMIT
  }

  if (slot.position_key === 'us-featured') {
    return US_FEATURED_PINNED_LIMIT
  }

  if (isMoreTopStoriesPositionKey(slot.position_key)) {
    return MORE_TOP_STORIES_PINNED_LIMIT
  }

  return null
}

/**
 * Resolve how many drop targets a slot should expose in the editor canvas.
 *
 * @param slot Homepage slot metadata.
 * @returns Number of index positions to render for the slot.
 */
function resolveSlotTargetCount(slot: ISlotOut): number {
  const pinnedLimit = resolveSlotPinnedLimit(slot)
  if (pinnedLimit != null) {
    return pinnedLimit
  }

  const pinnedLength = editorPinnedIds(slot).length
  return Math.max(pinnedLength, DEFAULT_TARGET_COUNT)
}

/**
 * Resolve the editor-facing label for a homepage slot.
 *
 * @param slot Homepage slot metadata.
 * @returns Human-friendly slot label for placement UI.
 */
export function resolveSlotLabel(slot: ISlotOut): string {
  return homepageSectionTitle(
    slot.position_key,
    slot.display_name,
    staticSectionLabelTranslator,
  )
}

/**
 * Sort homepage slots for the editor canvas in public-site layout order.
 *
 * @param slots Homepage slots from layout admin API.
 * @returns Slots ordered for editor placement UI.
 */
export function sortSlotsForEditorCanvas(slots: ISlotOut[]): ISlotOut[] {
  return [...slots].sort((left, right) => {
    const leftKey = left.position_key.trim().toLowerCase()
    const rightKey = right.position_key.trim().toLowerCase()
    const leftIndex = HOMEPAGE_EDITOR_SLOT_ORDER_INDEX.get(leftKey)
    const rightIndex = HOMEPAGE_EDITOR_SLOT_ORDER_INDEX.get(rightKey)

    if (leftIndex != null && rightIndex != null) {
      return leftIndex - rightIndex
    }
    if (leftIndex != null) {
      return -1
    }
    if (rightIndex != null) {
      return 1
    }

    return left.order_index - right.order_index
  })
}

/**
 * Build editor-friendly target cells for each homepage slot.
 *
 * @param slots Homepage slots from layout admin API.
 * @returns Visual drop targets keyed by slot and card index.
 */
export function buildPlacementTargets(slots: ISlotOut[]): IPlacementTarget[] {
  const targets: IPlacementTarget[] = []

  for (const slot of slots) {
    const editorSlot = slotForEditorPlacement(slot)
    const slotLabel = resolveSlotLabel(slot)
    const presentationType = slot.presentation_type || DEFAULT_PRESENTATION_TYPE
    const targetCount = resolveSlotTargetCount(slot)

    for (let index = 0; index < targetCount; index += 1) {
      targets.push({
        slotId: slot.id,
        slotLabel,
        positionKey: slot.position_key,
        contentType: slot.content_type,
        presentationType,
        moduleKind: moduleKindForPresentation(presentationType),
        index,
        articleId: pinnedIdAtIndex(editorSlot.pinned_ids, index),
      })
    }
  }

  return targets
}
