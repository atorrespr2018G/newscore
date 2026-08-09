/** Pure helpers for story pool and ordered report selection. */

import type { IMediaAsset } from '@/lib/media-editor-client'

export type DragListKind = 'pool' | 'selected'

export interface IDragPayload {
  assetId: string
  rootId: string
  source: DragListKind
}

/** One independently selectable card in the story pool. */
export interface IStoryPoolCard {
  rootId: string
  asset: IMediaAsset
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
 * Identity helper kept for drag payloads — each asset is its own root.
 * @param asset - Pool or report asset.
 * @returns The asset's own id.
 */
export function getRootId(asset: IMediaAsset): string {
  return asset.id
}

/**
 * Keep image/video assets that still exist in the library.
 * @param poolIds - Current pool IDs.
 * @param assetsById - Asset lookup.
 * @returns Pool IDs limited to existing image/video assets.
 */
export function sanitizePoolIds(poolIds: string[], assetsById: Map<string, IMediaAsset>): string[] {
  return poolIds.filter((id) => {
    const asset = assetsById.get(id)
    return Boolean(asset && (asset.file_type === 'image' || asset.file_type === 'video'))
  })
}

/**
 * Promote former nested edits into the pool as their own standalone items.
 * @param poolIds - Current pool IDs (may be originals only).
 * @param assets - Full library list.
 * @param assetsById - Asset lookup for legacy version_of walks.
 * @returns Pool IDs including every former nested edit under those roots.
 */
export function expandPoolWithDetachedEdits(
  poolIds: string[],
  assets: IMediaAsset[],
  assetsById: Map<string, IMediaAsset>,
): string[] {
  const next = [...poolIds]
  const seen = new Set(next)
  for (const poolId of poolIds) {
    for (const asset of assets) {
      if (asset.file_type !== 'image' && asset.file_type !== 'video') continue
      if (seen.has(asset.id)) continue
      if (_legacyRootId(asset, assetsById) !== poolId) continue
      next.push(asset.id)
      seen.add(asset.id)
    }
  }
  return next
}

/**
 * Walk legacy version_of links for one-time pool expansion.
 * @param asset - Asset that may still carry nested lineage.
 * @param assetsById - Asset lookup.
 * @returns Top-most ancestor id.
 */
function _legacyRootId(asset: IMediaAsset, assetsById: Map<string, IMediaAsset>): string {
  let current = asset
  const seen = new Set<string>()
  while (current.version_of) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    const parent = assetsById.get(current.version_of)
    if (!parent) return current.version_of
    current = parent
  }
  return current.id
}

/**
 * Keep report IDs that are exact members of the story pool.
 * @param selectedIds - Ordered report asset IDs.
 * @param poolIds - Sanitized pool IDs.
 * @param assetsById - Asset lookup.
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
    if (asset.file_type !== 'image' && asset.file_type !== 'video') return false
    return pool.has(id)
  })
}

/**
 * Build one pool card per pool asset — never nest edits inside another picture.
 * @param poolIds - Pool asset IDs.
 * @param _assets - Unused; kept for call-site compatibility.
 * @param assetsById - Asset lookup.
 * @returns Flat list of independently selectable pool cards.
 */
export function buildIndependentPoolCards(
  poolIds: string[],
  _assets: IMediaAsset[],
  assetsById: Map<string, IMediaAsset>,
): IStoryPoolCard[] {
  const cards: IStoryPoolCard[] = []
  for (const assetId of poolIds) {
    const asset = assetsById.get(assetId)
    if (!asset) continue
    if (asset.file_type !== 'image' && asset.file_type !== 'video') continue
    cards.push({ rootId: asset.id, asset })
  }
  return cards
}

/**
 * Short badge for a standalone pool/report card.
 * @param asset - Card asset.
 * @returns Display badge.
 */
export function versionBadgeLabel(asset: IMediaAsset): string {
  const name = `${asset.title ?? ''} ${asset.original_filename ?? ''}`.toLowerCase()
  if (name.includes('edit') || asset.original_filename.startsWith('edited-')) return 'Edit'
  return asset.file_type === 'video' ? 'Video' : 'Picture'
}

/**
 * Add one pool asset to the report.
 * @param poolIds - Current pool IDs.
 * @param selectedIds - Current ordered report IDs.
 * @param rootId - Pool membership id (same as asset id for independent assets).
 * @param assetId - Exact asset ID to add.
 * @param insertIndex - Optional index in the report list; defaults to append.
 * @returns Updated pool and selected ID lists.
 */
export function selectFromPool(
  poolIds: string[],
  selectedIds: string[],
  rootId: string,
  assetId: string,
  insertIndex?: number,
): { poolIds: string[]; selectedIds: string[] } {
  if (!poolIds.includes(rootId) && !poolIds.includes(assetId)) {
    throw new Error('Report pictures must come from the story originals pool')
  }
  if (selectedIds.includes(assetId)) {
    return { poolIds, selectedIds }
  }
  const index =
    insertIndex === undefined
      ? selectedIds.length
      : Math.max(0, Math.min(insertIndex, selectedIds.length))
  const nextSelected = [...selectedIds.slice(0, index), assetId, ...selectedIds.slice(index)]
  return { poolIds, selectedIds: nextSelected }
}

/**
 * Remove only the clicked report asset.
 * @param selectedIds - Current ordered report IDs.
 * @param assetId - Exact asset to remove from the report.
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
 * Add a newly saved edit as its own pool (and report) picture/video.
 * @param poolIds - Current pool IDs.
 * @param selectedIds - Current ordered report IDs.
 * @param _rootId - Unused; edits are not nested under a family root.
 * @param derivativeId - Newly saved independent asset ID.
 * @param sourceId - Asset that was edited.
 * @returns Updated pool and selected ID lists.
 */
export function adoptEditedDerivative(
  poolIds: string[],
  selectedIds: string[],
  _rootId: string,
  derivativeId: string,
  sourceId: string,
): { poolIds: string[]; selectedIds: string[] } {
  const nextPool = poolIds.includes(derivativeId) ? poolIds : [...poolIds, derivativeId]
  const withoutDerivative = selectedIds.filter((id) => id !== derivativeId)
  const sourceIndex = withoutDerivative.indexOf(sourceId)
  if (sourceIndex < 0) {
    return { poolIds: nextPool, selectedIds: withoutDerivative }
  }
  return {
    poolIds: nextPool,
    selectedIds: [
      ...withoutDerivative.slice(0, sourceIndex + 1),
      derivativeId,
      ...withoutDerivative.slice(sourceIndex + 1),
    ],
  }
}
