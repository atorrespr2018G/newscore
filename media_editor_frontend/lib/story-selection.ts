/** Pure helpers for story pool and ordered report selection. */

import type { IMediaAsset } from '@/lib/media-editor-client'

export type DragListKind = 'pool' | 'selected'

export interface IDragPayload {
  assetId: string
  rootId: string
  source: DragListKind
}

const DRAG_MIME = 'application/x-newscore-media-id'

/** MIME type used for HTML5 drag-and-drop between story collections. */
export function getDragMime(): string {
  return DRAG_MIME
}

/**
 * Encode a drag payload for transfer between story lists.
 * @param dataTransfer - Browser drag data store.
 * @param payload - Asset being dragged.
 */
export function writeDragPayload(dataTransfer: DataTransfer, payload: IDragPayload): void {
  const raw = JSON.stringify(payload)
  dataTransfer.setData(DRAG_MIME, raw)
  dataTransfer.setData('text/plain', raw)
  dataTransfer.effectAllowed = 'move'
}

/**
 * Read a drag payload from a drop event, or null when the mime is absent.
 * @param dataTransfer - Browser drag data store from the drop event.
 * @returns Parsed payload or null.
 * @throws When the payload JSON is present but invalid.
 */
export function readDragPayload(dataTransfer: DataTransfer): IDragPayload | null {
  const raw = dataTransfer.getData(DRAG_MIME) || dataTransfer.getData('text/plain')
  if (!raw) return null
  const parsed = JSON.parse(raw) as IDragPayload
  if (!parsed.assetId || !parsed.rootId || (parsed.source !== 'pool' && parsed.source !== 'selected')) {
    throw new Error('Invalid media drag payload')
  }
  return parsed
}

/**
 * Return the original upload ID for an asset or version.
 * Walks older intermediate version_of links created before root lineage was enforced.
 * @param asset - Asset or derivative.
 * @param assetsById - Optional lookup used to walk the full version chain.
 * @returns The top-most original upload ID.
 */
export function getRootId(asset: IMediaAsset, assetsById?: Map<string, IMediaAsset>): string {
  let current = asset
  const seen = new Set<string>()
  while (current.version_of) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    const parent = assetsById?.get(current.version_of)
    if (!parent) return current.version_of
    current = parent
  }
  return current.id
}

/**
 * Keep only original upload IDs in the story pool.
 * @param poolIds - Current pool IDs that may include accidental derivatives.
 * @param assetsById - Asset lookup used to detect derivatives.
 * @returns Pool IDs limited to original uploads.
 */
export function sanitizePoolIds(poolIds: string[], assetsById: Map<string, IMediaAsset>): string[] {
  return poolIds.filter((id) => {
    const asset = assetsById.get(id)
    return Boolean(asset && !asset.version_of)
  })
}

/**
 * Keep report IDs whose original still exists in the story pool.
 * Drops orphans that point at a deleted original (those break drag/save).
 * @param selectedIds - Ordered report asset IDs.
 * @param poolIds - Sanitized originals pool IDs.
 * @param assetsById - Asset lookup used to resolve roots.
 * @returns Report IDs that still validate against the pool.
 */
export function sanitizeSelectedIds(
  selectedIds: string[],
  poolIds: string[],
  assetsById: Map<string, IMediaAsset>,
): string[] {
  const pool = new Set(poolIds)
  return selectedIds.filter((id) => {
    const asset = assetsById.get(id)
    if (!asset) return false
    const rootId = getRootId(asset, assetsById)
    const root = assetsById.get(rootId)
    if (!root || root.version_of) return false
    return pool.has(rootId)
  })
}

/**
 * Choose the thumbnail asset for one originals-pool slot.
 * Prefers the version already chosen for the report, else the latest edit, else the original.
 * @param rootId - Original upload ID stored in the pool.
 * @param assets - All reporter assets.
 * @param selectedIds - Ordered report asset IDs.
 * @returns The single thumbnail asset for that picture family.
 */
export function getPreferredVersion(
  rootId: string,
  assets: IMediaAsset[],
  selectedIds: string[],
): IMediaAsset {
  const root = assets.find((asset) => asset.id === rootId)
  if (!root) {
    throw new Error(`Original picture ${rootId} was not found`)
  }
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const selectedMatch = selectedIds
    .map((id) => assets.find((asset) => asset.id === id))
    .find((asset) => asset && getRootId(asset, assetsById) === rootId)
  if (selectedMatch) return selectedMatch
  const versions = assets
    .filter((asset) => asset.version_of === rootId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
  return versions[0] ?? root
}

/**
 * Move a picture family from the originals pool into the ordered report list.
 * @param poolIds - Current originals pool IDs (roots only).
 * @param selectedIds - Current ordered report IDs.
 * @param rootId - Original upload ID for the dragged family.
 * @param versionId - Version thumbnail currently shown for that family.
 * @param insertIndex - Optional index in the report list; defaults to append.
 * @param resolveRootId - Maps any selected ID to its original upload ID.
 * @returns Updated pool and selected ID lists.
 */
export function selectFromPool(
  poolIds: string[],
  selectedIds: string[],
  rootId: string,
  versionId: string,
  insertIndex: number | undefined,
  resolveRootId: (assetId: string) => string,
): { poolIds: string[]; selectedIds: string[] } {
  if (!poolIds.includes(rootId)) {
    throw new Error('Report pictures must come from the story originals pool')
  }
  const without = selectedIds.filter((id) => {
    try {
      return resolveRootId(id) !== rootId
    } catch {
      return id !== rootId && id !== versionId
    }
  })
  const index = insertIndex === undefined ? without.length : Math.max(0, Math.min(insertIndex, without.length))
  const nextSelected = [...without.slice(0, index), versionId, ...without.slice(index)]
  return { poolIds, selectedIds: nextSelected }
}

/**
 * Remove an asset (and any other report slots in its original family) from the report.
 * Keeps the original in the pool.
 * @param selectedIds - Current ordered report IDs.
 * @param assetId - Asset (or version) to remove from the report.
 * @param assetsById - Optional lookup used to drop the whole picture/video family.
 * @returns Updated selected ID list.
 */
export function removeFromSelected(
  selectedIds: string[],
  assetId: string,
  assetsById?: Map<string, IMediaAsset>,
): string[] {
  if (!assetsById) {
    return selectedIds.filter((id) => id !== assetId)
  }
  const target = assetsById.get(assetId)
  if (!target) {
    return selectedIds.filter((id) => id !== assetId)
  }
  const rootId = getRootId(target, assetsById)
  return selectedIds.filter((id) => {
    const asset = assetsById.get(id)
    if (!asset) return id !== assetId
    return getRootId(asset, assetsById) !== rootId
  })
}

/**
 * Reorder an asset inside the ordered report list.
 * @param selectedIds - Current ordered report IDs.
 * @param assetId - Asset being moved.
 * @param insertIndex - Target index after removal.
 * @returns Reordered selected ID list.
 */
export function reorderSelected(selectedIds: string[], assetId: string, insertIndex: number): string[] {
  const without = selectedIds.filter((id) => id !== assetId)
  if (without.length === selectedIds.length) {
    throw new Error('Asset is not in the report selection')
  }
  const index = Math.max(0, Math.min(insertIndex, without.length))
  return [...without.slice(0, index), assetId, ...without.slice(index)]
}

/**
 * Keep the originals pool on the root upload and point the report at the new edit.
 * @param poolIds - Current originals pool IDs.
 * @param selectedIds - Current ordered report IDs.
 * @param rootId - Original upload ID for the edited family.
 * @param derivativeId - Newly saved edited asset ID.
 * @param resolveRootId - Maps any selected ID to its original upload ID.
 * @returns Updated pool and selected ID lists.
 */
export function adoptEditedDerivative(
  poolIds: string[],
  selectedIds: string[],
  rootId: string,
  derivativeId: string,
  resolveRootId: (assetId: string) => string,
): { poolIds: string[]; selectedIds: string[] } {
  const nextPool = poolIds.filter((id) => id !== derivativeId)
  if (!nextPool.includes(rootId)) nextPool.push(rootId)
  const familyInReport = selectedIds.some((id) => resolveRootId(id) === rootId)
  const nextSelected = familyInReport
    ? selectedIds.map((id) => (resolveRootId(id) === rootId ? derivativeId : id))
    : selectedIds
  return { poolIds: nextPool, selectedIds: nextSelected }
}
