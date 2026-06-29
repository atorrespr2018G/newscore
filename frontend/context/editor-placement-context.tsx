'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ISlotOut } from '@/lib/api/layout-client'
import type { PlacementMoveDirectionType } from '@/lib/helpers/editor-placement'
import type { IPlacementTarget } from '@/lib/helpers/editor-placement-targets'
import { editorPinnedIds } from '@/lib/helpers/slot-editor-pinned-ids'

/** Pinned-article lookup for a single homepage slot in the editor canvas. */
interface ISlotPinnedInfo {
  /** Maps a pinned article id to its zero-based index within the slot. */
  indexByArticleId: Map<string, number>
  /** Number of pinned articles currently staged in the slot. */
  count: number
  /**
   * Cell index a freshly dropped story should land in so it appends after the
   * slot's existing pins. The preview compacts pins to the front, so empty cells
   * between pins are never rendered; appending is the only stable landing spot.
   */
  appendIndex: number
  /** Placement target for the slot's first cell, used to clone append targets. */
  templateTarget: IPlacementTarget | null
}

/** Interactive placement state shared with the WYSIWYG homepage modules. */
interface IEditorPlacementContextValue {
  placementTargetByKey: Map<string, IPlacementTarget>
  pinnedInfoBySlotId: Map<string, ISlotPinnedInfo>
  selectedArticleId: string | null
  saving: boolean
  onDropPlacement: (articleId: string, target: IPlacementTarget) => void
  onRemovePlacement: (target: IPlacementTarget) => void
  onMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => void
}

const EditorPlacementContext = createContext<IEditorPlacementContextValue | null>(null)
const PlacementSlotContext = createContext<string | null>(null)

/**
 * Build the stable key used to look up a placement target by slot and index.
 *
 * @param slotId Homepage slot id.
 * @param index Zero-based cell index within the slot.
 * @returns Composite lookup key for `placementTargetByKey`.
 */
export function placementTargetKey(slotId: string, index: number): string {
  return `${slotId}:${index}`
}

/**
 * Read the active editor placement context.
 *
 * @returns Placement state when rendered inside the editor canvas, else null.
 */
export function useEditorPlacement(): IEditorPlacementContextValue | null {
  return useContext(EditorPlacementContext)
}

/**
 * Read the homepage slot id for the surrounding module scope.
 *
 * @returns The current slot id, or null when outside a placement slot scope.
 */
export function usePlacementSlotId(): string | null {
  return useContext(PlacementSlotContext)
}

interface IEditorPlacementProviderProps {
  placementTargets: IPlacementTarget[]
  homepageSlots: ISlotOut[]
  selectedArticleId: string | null
  saving: boolean
  onDropPlacement: (articleId: string, target: IPlacementTarget) => void
  onRemovePlacement: (target: IPlacementTarget) => void
  onMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => void
  children: ReactNode
}

/**
 * Count how many placement target cells a slot exposes.
 *
 * @param placementTargetByKey Lookup of placement targets by slot/index key.
 * @param slotId Homepage slot id to tally.
 * @returns Number of target cells configured for the slot.
 */
function countTargetsForSlot(
  placementTargetByKey: Map<string, IPlacementTarget>,
  slotId: string,
): number {
  let count = 0
  for (const target of placementTargetByKey.values()) {
    if (target.slotId === slotId) {
      count += 1
    }
  }
  return count
}

/**
 * Resolve the cell index a dropped story should land in.
 *
 * Targets the first empty cell so drops fill the slot top-down; the preview
 * compacts pins to the front, so the first empty cell is where a new story
 * becomes visible right after the existing pins. A full slot falls back to the
 * final cell, letting the shift-down insert evict the trailing story.
 *
 * @param pinnedIds Staged pin ids for the slot (may contain empty placeholders).
 * @param cellCount Total target cells the slot exposes.
 * @returns Zero-based cell index for the drop.
 */
function resolveAppendIndex(pinnedIds: string[], cellCount: number): number {
  const limit = cellCount > 0 ? cellCount : pinnedIds.length
  for (let index = 0; index < limit; index += 1) {
    const id = pinnedIds[index]
    if (!id || !id.trim()) {
      return index
    }
  }
  return Math.max(limit - 1, 0)
}

/**
 * Build the per-slot pinned lookup map from the editor's homepage slots.
 *
 * @param homepageSlots Homepage slots carrying staged draft pins.
 * @param placementTargetByKey Lookup of placement targets by slot/index key.
 * @returns Map of slot id to its pinned-article index lookup and capacity.
 */
function buildPinnedInfoBySlotId(
  homepageSlots: ISlotOut[],
  placementTargetByKey: Map<string, IPlacementTarget>,
): Map<string, ISlotPinnedInfo> {
  const pinnedInfoBySlotId = new Map<string, ISlotPinnedInfo>()
  for (const slot of homepageSlots) {
    const pinnedIds = editorPinnedIds(slot)
    const indexByArticleId = new Map<string, number>()
    pinnedIds.forEach((id, index) => {
      if (id && id.trim()) {
        indexByArticleId.set(id, index)
      }
    })
    const cellCount = countTargetsForSlot(placementTargetByKey, slot.id)
    pinnedInfoBySlotId.set(slot.id, {
      indexByArticleId,
      count: pinnedIds.length,
      appendIndex: resolveAppendIndex(pinnedIds, cellCount),
      templateTarget: placementTargetByKey.get(placementTargetKey(slot.id, 0)) ?? null,
    })
  }
  return pinnedInfoBySlotId
}

/**
 * Provide interactive placement state to the WYSIWYG homepage modules.
 *
 * Without this provider the homepage modules render exactly as the public site.
 *
 * @param props Placement targets, slots, selection, and mutation callbacks.
 * @returns Context provider wrapping the editable homepage content.
 */
export function EditorPlacementProvider(props: IEditorPlacementProviderProps): JSX.Element {
  const {
    placementTargets,
    homepageSlots,
    selectedArticleId,
    saving,
    onDropPlacement,
    onRemovePlacement,
    onMovePlacement,
    children,
  } = props

  const value = useMemo<IEditorPlacementContextValue>(() => {
    const placementTargetByKey = new Map<string, IPlacementTarget>()
    for (const target of placementTargets) {
      placementTargetByKey.set(placementTargetKey(target.slotId, target.index), target)
    }
    return {
      placementTargetByKey,
      pinnedInfoBySlotId: buildPinnedInfoBySlotId(homepageSlots, placementTargetByKey),
      selectedArticleId,
      saving,
      onDropPlacement,
      onRemovePlacement,
      onMovePlacement,
    }
  }, [placementTargets, homepageSlots, selectedArticleId, saving, onDropPlacement, onRemovePlacement, onMovePlacement])

  return <EditorPlacementContext.Provider value={value}>{children}</EditorPlacementContext.Provider>
}

interface IPlacementSlotScopeProps {
  slotId: string
  children: ReactNode
}

/**
 * Scope a homepage module subtree to a single slot id for placement overlays.
 *
 * Renders children untouched when no editor placement context is active.
 *
 * @param props Slot id and the module subtree to scope.
 * @returns The scoped subtree, or the bare children on the public site.
 */
export function PlacementSlotScope({ slotId, children }: IPlacementSlotScopeProps): JSX.Element {
  const editor = useEditorPlacement()
  if (!editor) {
    return <>{children}</>
  }
  return <PlacementSlotContext.Provider value={slotId}>{children}</PlacementSlotContext.Provider>
}
