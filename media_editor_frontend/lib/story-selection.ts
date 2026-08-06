/** Pure helpers for story pool and ordered report selection. */

import type { IMediaAsset } from '@/lib/media-editor-client'

export type DragListKind = 'pool' | 'selected'

export interface IDragPayload {
  assetId: string
  rootId: string
  source: DragListKind
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
 * Remove an asset from the ordered report list while keeping it in the pool.
 * @param selectedIds - Current ordered report IDs.
 * @param assetId - Asset to remove from the report.
 * @returns Updated selected ID list.
 */
export function removeFromSelected(selectedIds: string[], assetId: string): string[] {
  return selectedIds.filter((id) => id !== assetId)
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
