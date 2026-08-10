'use client'

import { DragEvent, PointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { MediaThumb } from '@/components/media-thumb'
import { IMediaAsset, IMediaStory } from '@/lib/media-editor-client'
import { htmlToPlainText } from '@/lib/media-metadata'
import {
  buildIndependentPoolCards,
  getRootId,
  IDragPayload,
  readDragPayload,
  removeFromSelected,
  reorderSelected,
  sanitizePoolIds,
  selectFromPool,
  versionBadgeLabel,
} from '@/lib/story-selection'

/**
 * Short plain-text subtitle for a media card.
 * @param asset - Asset shown on the card.
 * @param hasEdits - Whether this card is an edited derivative.
 * @returns Display subtitle without raw HTML tags.
 */
function cardSubtitle(asset: IMediaAsset, hasEdits: boolean): string {
  const plain = asset.description ? htmlToPlainText(asset.description) : ''
  if (plain) return plain
  return hasEdits ? 'Edited' : asset.file_type
}

const DRAG_THRESHOLD_PX = 12

/**
 * Whether a viewport point lies inside a DOM rect.
 * @param clientX - Viewport X.
 * @param clientY - Viewport Y.
 * @param rect - Target element bounds.
 * @returns True when the point is inside the rect.
 */
function pointInRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
}

interface IStoryWorkspaceProps {
  story: IMediaStory
  assetsById: Map<string, IMediaAsset>
  assets: IMediaAsset[]
  selectedAssetId: string | null
  /** Asset ids checked for send-to-editor (report order only). */
  exportAssetIds: ReadonlySet<string>
  poolUploadControl: ReactNode
  onSelectAsset: (asset: IMediaAsset) => void
  onToggleExportAsset: (assetId: string) => void
  onEditImage: (asset: IMediaAsset) => void
  onEditVideo: (asset: IMediaAsset) => void
  onMergeVideos: () => Promise<void>
  onRemoveBackground: (asset: IMediaAsset) => void
  onDeleteAsset: (asset: IMediaAsset) => void
  onStoryChange: (story: IMediaStory) => Promise<void>
  onError: (message: string) => void
  removingBackground?: boolean
  mergingVideos?: boolean
  mergeCandidateCount?: number
}

/**
 * Reporter board: move originals into the ordered report collection.
 * @param props - Active story, asset lookup, and persistence callbacks.
 * @returns Dual-collection workspace for one news story.
 */
export function StoryWorkspace({
  story,
  assetsById,
  assets,
  selectedAssetId,
  exportAssetIds,
  poolUploadControl,
  onSelectAsset,
  onToggleExportAsset,
  onEditImage,
  onEditVideo,
  onMergeVideos,
  onRemoveBackground,
  onDeleteAsset,
  onStoryChange,
  onError,
  removingBackground = false,
  mergingVideos = false,
  mergeCandidateCount = 0,
}: IStoryWorkspaceProps): JSX.Element {
  const [dropHint, setDropHint] = useState<'pool' | 'selected' | null>(null)
  const [dragPayload, setDragPayload] = useState<IDragPayload | null>(null)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null)
  const dragOrigin = useRef<{ x: number; y: number; payload: IDragPayload } | null>(null)
  const activeDragRef = useRef<IDragPayload | null>(null)
  const suppressClickRef = useRef(false)
  const storyRef = useRef(story)
  const poolRootIdsRef = useRef<string[]>([])
  const assetsByIdRef = useRef(assetsById)
  const reportPaneRef = useRef<HTMLElement | null>(null)
  const poolPaneRef = useRef<HTMLElement | null>(null)
  const onErrorRef = useRef(onError)
  const onStoryChangeRef = useRef(onStoryChange)
  const onSelectAssetRef = useRef(onSelectAsset)
  onErrorRef.current = onError
  onStoryChangeRef.current = onStoryChange
  onSelectAssetRef.current = onSelectAsset

  const poolRootIds = useMemo(
    () => sanitizePoolIds(story.pool_asset_ids, assetsById),
    [story.pool_asset_ids, assetsById],
  )

  storyRef.current = story
  poolRootIdsRef.current = poolRootIds
  assetsByIdRef.current = assetsById

  async function persist(next: IMediaStory): Promise<void> {
    try {
      await onStoryChangeRef.current(next)
    } catch (error) {
      onErrorRef.current(error instanceof Error ? error.message : 'Unable to update story collections')
    }
  }

  /**
   * Visual insert slot in the report grid (before card index, or length to append).
   * @param clientX - Pointer X in the viewport.
   * @param clientY - Pointer Y in the viewport.
   * @returns Index in the current report card list.
   */
  function reportVisualInsertIndex(clientX: number, clientY: number): number {
    const cards = reportPaneRef.current?.querySelectorAll<HTMLElement>('[data-report-index]')
    const count = cards?.length ?? 0
    if (!cards?.length) return 0

    let bestIndex = count
    let bestDist = Number.POSITIVE_INFINITY
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      const midY = rect.top + rect.height / 2
      const dist = Math.hypot(clientX - midX, clientY - midY)
      if (dist >= bestDist) return
      bestDist = dist
      const insertBefore =
        clientX < midX || (Math.abs(clientX - midX) <= rect.width * 0.15 && clientY < midY)
      bestIndex = insertBefore ? index : index + 1
    })
    return Math.max(0, Math.min(bestIndex, count))
  }

  /**
   * Insert index in the report list after the dragged id is removed.
   * @param clientX - Pointer X in the viewport.
   * @param clientY - Pointer Y in the viewport.
   * @param draggedAssetId - Asset being reordered.
   * @returns Zero-based insert position for reorderSelected.
   */
  function reportReorderInsertIndex(
    clientX: number,
    clientY: number,
    draggedAssetId: string,
  ): number {
    const ids = storyRef.current.selected_asset_ids
    const fromIndex = ids.indexOf(draggedAssetId)
    const maxIndex = Math.max(0, ids.length - (fromIndex >= 0 ? 1 : 0))
    let bestIndex = reportVisualInsertIndex(clientX, clientY)
    if (fromIndex >= 0 && fromIndex < bestIndex) {
      bestIndex -= 1
    }
    return Math.max(0, Math.min(bestIndex, maxIndex))
  }

  function applyDrop(
    payload: IDragPayload,
    zone: 'pool' | 'selected',
    clientX?: number,
    clientY?: number,
  ): void {
    const currentStory = storyRef.current
    const currentPool = poolRootIdsRef.current
    try {
      if (zone === 'selected' && payload.source === 'pool') {
        const insertIndex =
          clientX === undefined || clientY === undefined
            ? undefined
            : reportReorderInsertIndex(clientX, clientY, payload.assetId)
        const next = selectFromPool(
          currentPool,
          currentStory.selected_asset_ids,
          payload.rootId,
          payload.assetId,
          insertIndex,
        )
        void persist({
          ...currentStory,
          pool_asset_ids: next.poolIds,
          selected_asset_ids: next.selectedIds,
          status: 'draft',
        })
        return
      }
      if (zone === 'selected' && payload.source === 'selected') {
        if (clientX === undefined || clientY === undefined) return
        const insertIndex = reportReorderInsertIndex(clientX, clientY, payload.assetId)
        const nextSelected = reorderSelected(
          currentStory.selected_asset_ids,
          payload.assetId,
          insertIndex,
        )
        if (nextSelected.join('\0') === currentStory.selected_asset_ids.join('\0')) return
        void persist({
          ...currentStory,
          pool_asset_ids: currentPool,
          selected_asset_ids: nextSelected,
          status: 'draft',
        })
        return
      }
      if (zone === 'pool' && payload.source === 'selected') {
        void persist({
          ...currentStory,
          pool_asset_ids: currentPool,
          selected_asset_ids: removeFromSelected(
            currentStory.selected_asset_ids,
            payload.assetId,
          ),
          status: 'draft',
        })
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Drop failed')
    }
  }

  function addPoolAssetToReport(asset: IMediaAsset): void {
    const rootId = getRootId(asset)
    try {
      const next = selectFromPool(
        poolRootIds,
        story.selected_asset_ids,
        rootId,
        asset.id,
      )
      void persist({
        ...story,
        pool_asset_ids: next.poolIds,
        selected_asset_ids: next.selectedIds,
        status: 'draft',
      })
      onSelectAsset(asset)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to add picture to report')
    }
  }

  /**
   * Drop one report media item from the ordered report list.
   * @param assetId - Exact report asset to remove (sibling edits stay).
   */
  function removeAssetFromReport(assetId: string): void {
    const currentStory = storyRef.current
    void persist({
      ...currentStory,
      pool_asset_ids: poolRootIdsRef.current,
      selected_asset_ids: removeFromSelected(currentStory.selected_asset_ids, assetId),
      status: 'draft',
    })
  }

  function zoneAtPoint(clientX: number, clientY: number): 'pool' | 'selected' | null {
    const reportBox = reportPaneRef.current?.getBoundingClientRect()
    const poolBox = poolPaneRef.current?.getBoundingClientRect()
    // Prefer report when panes are stacked and the pointer sits on the boundary.
    if (reportBox && pointInRect(clientX, clientY, reportBox)) return 'selected'
    if (poolBox && pointInRect(clientX, clientY, poolBox)) return 'pool'
    return null
  }

  useEffect(() => {
    function onPointerMove(event: globalThis.PointerEvent): void {
      const origin = dragOrigin.current
      if (!origin) return
      const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
      if (distance < DRAG_THRESHOLD_PX) return
      suppressClickRef.current = true
      activeDragRef.current = origin.payload
      setDragPayload(origin.payload)
      setDragPoint({ x: event.clientX, y: event.clientY })
      const zone = zoneAtPoint(event.clientX, event.clientY)
      setDropHint(zone)
      if (zone === 'selected') {
        setDropInsertIndex(reportVisualInsertIndex(event.clientX, event.clientY))
      } else {
        setDropInsertIndex(null)
      }
    }

    function onPointerUp(event: globalThis.PointerEvent): void {
      const active = activeDragRef.current
      const origin = dragOrigin.current
      const wasDragging = Boolean(active)
      dragOrigin.current = null
      activeDragRef.current = null
      if (active) {
        const zone = zoneAtPoint(event.clientX, event.clientY)
        if (zone) applyDrop(active, zone, event.clientX, event.clientY)
        else if (active.source === 'pool') {
          // Fallback when release lands just outside the report card (stacked or side-by-side).
          const poolBox = poolPaneRef.current?.getBoundingClientRect()
          const reportBox = reportPaneRef.current?.getBoundingClientRect()
          if (
            poolBox
            && reportBox
            && (event.clientY > poolBox.bottom - 8 || event.clientX > poolBox.right - 8)
          ) {
            applyDrop(active, 'selected', event.clientX, event.clientY)
          }
        }
      } else if (origin) {
        // Prefer pointer-up selection — click is often swallowed after tiny pointer jitter.
        const asset = assetsByIdRef.current.get(origin.payload.assetId)
        if (asset) onSelectAssetRef.current(asset)
      }
      setDragPayload(null)
      setDragPoint(null)
      setDropHint(null)
      setDropInsertIndex(null)
      if (wasDragging) {
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
    }

    // Capture phase so scroll containers / pointer capture cannot swallow the gesture.
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerUp, true)
    return () => {
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerUp, true)
    }
    // Listeners read the latest logic through refs; mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const poolCards: IStoryCard[] = useMemo(
    () =>
      buildIndependentPoolCards(poolRootIds, assets, assetsById).map((card) => ({
        rootId: card.rootId,
        asset: card.asset,
        badge: versionBadgeLabel(card.asset),
      })),
    [poolRootIds, assets, assetsById],
  )

  const selectedCards = story.selected_asset_ids.flatMap((id): IStoryCard[] => {
    const asset = assetsById.get(id)
    if (!asset) return []
    return [{
      rootId: getRootId(asset),
      asset,
      badge: versionBadgeLabel(asset),
    }]
  })

  const reportTarget = selectedCards.find((card) => card.asset.id === selectedAssetId)?.asset ?? null
  const poolTarget = poolCards.find((card) => card.asset.id === selectedAssetId)?.asset ?? null

  const draggedAsset = dragPayload
    ? assetsById.get(dragPayload.assetId) ?? null
    : null

  function beginDrag(event: PointerEvent<HTMLElement>, payload: IDragPayload): void {
    if (event.button !== 0) return
    // Avoid setPointerCapture — it can trap move/up inside the card and break drops.
    suppressClickRef.current = false
    dragOrigin.current = { x: event.clientX, y: event.clientY, payload }
    // Select immediately so Edition (headline/description) enables even if this
    // press becomes a drag reorder.
    const asset = assetsByIdRef.current.get(payload.assetId)
    if (asset) onSelectAssetRef.current(asset)
  }

  function handleCardClick(asset: IMediaAsset): void {
    if (suppressClickRef.current) return
    onSelectAsset(asset)
  }

  function handleHtmlDrop(event: DragEvent<HTMLElement>, zone: 'pool' | 'selected'): void {
    event.preventDefault()
    setDropHint(null)
    try {
      const payload = readDragPayload(event.dataTransfer)
      if (!payload) return
      applyDrop(payload, zone, event.clientX, event.clientY)
    } catch (error) {
      onErrorRef.current(error instanceof Error ? error.message : 'Drop failed')
    }
  }

  return (
    <div className="story-board flex flex-col gap-4">
      <CollectionPane
        paneRef={poolPaneRef}
        className="min-w-0 w-full"
        title="All pictures for this news"
        subtitle="Each picture or video stands alone — an edit becomes a new item, never nested inside another"
        emptyLabel="Use Add pictures above to load originals for this story"
        cards={poolCards}
        selectedAssetId={selectedAssetId}
        dragSource="pool"
        highlight={dropHint === 'pool'}
        toolbar={
          <>
            {poolUploadControl}
            <PoolPictureActions
              asset={poolTarget}
              alreadyInReport={Boolean(
                poolTarget && story.selected_asset_ids.includes(poolTarget.id),
              )}
              onAddToReport={addPoolAssetToReport}
              onDeleteAsset={onDeleteAsset}
            />
          </>
        }
        onSelectAsset={handleCardClick}
        onCardPointerDown={beginDrag}
        onDragOver={(event) => {
          event.preventDefault()
          setDropHint('pool')
        }}
        onDragLeave={() => setDropHint(null)}
        onDrop={(event) => handleHtmlDrop(event, 'pool')}
      />
      <CollectionPane
        paneRef={reportPaneRef}
        className="min-w-0 w-full"
        title="Pictures for the report"
        subtitle="Report order — check items to send to NewsCore Editor. Drag to reorder."
        emptyLabel="Drop pictures here from the pool"
        cards={selectedCards}
        selectedAssetId={selectedAssetId}
        exportAssetIds={exportAssetIds}
        dragSource="selected"
        highlight={dropHint === 'selected'}
        showOrder
        draggingAssetId={dragPayload?.source === 'selected' ? dragPayload.assetId : null}
        dropInsertIndex={dragPayload ? dropInsertIndex : null}
        toolbar={
          <ReportPictureActions
            asset={reportTarget}
            mergeCandidateCount={mergeCandidateCount}
            removingBackground={removingBackground}
            mergingVideos={mergingVideos}
            onEditImage={onEditImage}
            onEditVideo={onEditVideo}
            onMergeVideos={onMergeVideos}
            onRemoveBackground={onRemoveBackground}
            onRemoveFromReport={removeAssetFromReport}
          />
        }
        onSelectAsset={handleCardClick}
        onToggleExportAsset={onToggleExportAsset}
        onRemoveCard={removeAssetFromReport}
        onCardPointerDown={beginDrag}
        onDragOver={(event) => {
          event.preventDefault()
          setDropHint('selected')
        }}
        onDragLeave={() => setDropHint(null)}
        onDrop={(event) => handleHtmlDrop(event, 'selected')}
      />
      {dragPayload && dragPoint && draggedAsset && (
        <div
          className="pointer-events-none fixed z-[60] w-40 overflow-hidden rounded-xl border-2 border-brand bg-white shadow-lift"
          style={{
            left: dragPoint.x - 80,
            top: dragPoint.y - 56,
            transform: 'rotate(-3deg) scale(1.04)',
          }}
        >
          <div className="relative aspect-[4/3] w-full bg-brand-mist">
            <MediaThumb asset={draggedAsset} />
            {dragPayload.source === 'selected' && (
              <span className="absolute left-1.5 top-1.5 rounded bg-brand-ink/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Moving
              </span>
            )}
          </div>
          <div className="px-2 py-1.5">
            <p className="truncate text-xs font-semibold text-brand-ink">
              {draggedAsset.title ?? draggedAsset.original_filename}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
              {dragPayload.source === 'pool'
                ? 'Drop on report to add'
                : dropHint === 'pool'
                  ? 'Drop on originals to remove'
                  : 'Drop between cards to reorder'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

interface IPoolPictureActionsProps {
  asset: IMediaAsset | null
  alreadyInReport: boolean
  onAddToReport: (asset: IMediaAsset) => void
  onDeleteAsset: (asset: IMediaAsset) => void
}

/** Actions for the selected originals-pool picture: add to report or delete permanently. */
function PoolPictureActions({
  asset,
  alreadyInReport,
  onAddToReport,
  onDeleteAsset,
}: IPoolPictureActionsProps): JSX.Element {
  return (
    <div className="mb-4 rounded-xl border border-brand-line bg-brand-paper px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Originals actions
        </p>
        <p className="truncate text-xs text-slate-500">
          {asset
            ? `Selected: ${asset.title ?? asset.original_filename}`
            : 'Select a picture in the originals list'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="me-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!asset || alreadyInReport}
          onClick={() => asset && onAddToReport(asset)}
        >
          {alreadyInReport ? 'Already in report' : 'Add to report'}
        </button>
        <button
          type="button"
          className="me-btn-danger px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!asset}
          onClick={() => asset && onDeleteAsset(asset)}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

interface IReportPictureActionsProps {
  asset: IMediaAsset | null
  mergeCandidateCount: number
  removingBackground: boolean
  mergingVideos: boolean
  onEditImage: (asset: IMediaAsset) => void
  onEditVideo: (asset: IMediaAsset) => void
  onMergeVideos: () => Promise<void>
  onRemoveBackground: (asset: IMediaAsset) => void
  onRemoveFromReport: (assetId: string) => void
}

/** Report-only actions: edit media, merge videos, or remove from report. */
function ReportPictureActions({
  asset,
  mergeCandidateCount,
  removingBackground,
  mergingVideos,
  onEditImage,
  onEditVideo,
  onMergeVideos,
  onRemoveBackground,
  onRemoveFromReport,
}: IReportPictureActionsProps): JSX.Element {
  const enabled = Boolean(asset)
  const isImage = asset?.file_type === 'image'
  const isVideo = asset?.file_type === 'video'
  const canMerge = mergeCandidateCount >= 2 && !mergingVideos

  return (
    <div className="mb-4 rounded-xl border border-brand-line bg-brand-paper px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Media actions
        </p>
        <p className="truncate text-xs text-slate-500">
          {asset
            ? `Selected: ${asset.title ?? asset.original_filename}`
            : 'Select a media item in the report list'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="me-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!enabled || !isImage}
          onClick={() => asset && onEditImage(asset)}
        >
          Edit image
        </button>
        <button
          type="button"
          className="me-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!enabled || !isVideo}
          onClick={() => asset && onEditVideo(asset)}
        >
          Edit video
        </button>
        <button
          type="button"
          className="me-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canMerge}
          title={
            mergeCandidateCount < 2
              ? 'Add at least two videos to the story, then choose which to merge'
              : 'Choose which videos to merge into one file'
          }
          onClick={() => void onMergeVideos()}
        >
          {mergingVideos ? 'Merging…' : 'Merge videos…'}
        </button>
        <button
          type="button"
          className="me-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!enabled || !isImage || removingBackground}
          onClick={() => asset && onRemoveBackground(asset)}
        >
          {removingBackground ? 'Removing…' : 'Remove background'}
        </button>
        <button
          type="button"
          className="me-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!enabled}
          onClick={() => asset && onRemoveFromReport(asset.id)}
        >
          Remove from report
        </button>
      </div>
    </div>
  )
}

interface IStoryCard {
  rootId: string
  asset: IMediaAsset
  badge?: string
}

interface ICollectionPaneProps {
  paneRef: React.MutableRefObject<HTMLElement | null>
  className?: string
  title: string
  subtitle: string
  emptyLabel: string
  cards: IStoryCard[]
  selectedAssetId: string | null
  exportAssetIds?: ReadonlySet<string>
  dragSource: 'pool' | 'selected'
  highlight: boolean
  showOrder?: boolean
  draggingAssetId?: string | null
  dropInsertIndex?: number | null
  toolbar?: ReactNode
  onSelectAsset: (asset: IMediaAsset) => void
  onToggleExportAsset?: (assetId: string) => void
  onRemoveCard?: (assetId: string) => void
  onCardPointerDown: (event: PointerEvent<HTMLElement>, payload: IDragPayload) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

/** One story collection pane with pointer-drag cards (native HTML5 drag disabled so clicks select). */
function CollectionPane({
  paneRef,
  className = '',
  title,
  subtitle,
  emptyLabel,
  cards,
  selectedAssetId,
  exportAssetIds,
  dragSource,
  highlight,
  showOrder = false,
  draggingAssetId = null,
  dropInsertIndex = null,
  toolbar,
  onSelectAsset,
  onToggleExportAsset,
  onRemoveCard,
  onCardPointerDown,
  onDragOver,
  onDragLeave,
  onDrop,
}: ICollectionPaneProps): JSX.Element {
  return (
    <section
      ref={paneRef as React.RefObject<HTMLElement>}
      data-drop-zone={dragSource}
      className={`me-panel flex min-h-[320px] flex-col p-4 md:p-5 ${className} ${
        highlight ? 'ring-2 ring-brand/30 border-brand/40' : ''
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mb-4">
        <p className="me-label mb-0">{dragSource === 'pool' ? 'Originals' : 'Report order'}</p>
        <h2 className="font-serif text-2xl text-brand-ink md:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {toolbar}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-line bg-brand-paper px-4 py-14 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <ul className="story-media-grid">
          {cards.map(({ rootId, asset, badge }, index) => {
            const active = asset.id === selectedAssetId
            const hasEdits = false
            const isDraggingCard = draggingAssetId === asset.id
            const showInsertBefore = showOrder && dropInsertIndex === index
            const showInsertAfter =
              showOrder && dropInsertIndex === cards.length && index === cards.length - 1
            return (
              <li
                key={`${dragSource}-${asset.id}`}
                className="relative min-w-0"
                data-report-index={showOrder ? String(index) : undefined}
              >
                {showInsertBefore && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -left-1 top-1 bottom-1 z-20 w-1.5 rounded-full bg-brand shadow-lift"
                  />
                )}
                <article
                  draggable={false}
                  className={`flex h-full cursor-grab touch-none flex-col overflow-hidden rounded-xl border bg-white active:cursor-grabbing select-none ${
                    active ? 'border-brand shadow-lift ring-2 ring-brand/15' : 'border-brand-line hover:border-slate-300'
                  } ${isDraggingCard ? 'opacity-35 ring-2 ring-brand/40' : ''}`}
                  onClick={() => onSelectAsset(asset)}
                  onPointerDown={(event) => {
                    onCardPointerDown(event, {
                      assetId: asset.id,
                      rootId,
                      source: dragSource,
                    })
                  }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-mist">
                    <MediaThumb asset={asset} />
                    <span className="absolute left-1.5 top-1.5 z-10 rounded bg-brand-ink/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {showOrder ? `${index + 1} · ${badge || 'Item'}` : badge || 'Item'}
                    </span>
                    {showOrder && onRemoveCard && (
                      <button
                        type="button"
                        className="absolute right-1.5 top-1.5 rounded bg-brand-ink/85 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-brand"
                        aria-label={`Remove ${asset.title ?? asset.original_filename} from report`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onRemoveCard(asset.id)
                        }}
                        onPointerDown={(event) => {
                          // Keep card drag from starting when pressing the remove control.
                          event.stopPropagation()
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="min-w-0 px-2 py-2 sm:px-2.5">
                    <p className="truncate text-xs font-semibold text-brand-ink sm:text-sm">
                      {asset.title ?? asset.original_filename}
                    </p>
                    <p
                      className="truncate text-[11px] text-slate-500 sm:text-xs"
                      title={asset.description ? htmlToPlainText(asset.description) : undefined}
                    >
                      {cardSubtitle(asset, hasEdits)}
                      {!hasEdits && asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                      {active ? ' · selected' : ''}
                    </p>
                    {showOrder && onToggleExportAsset ? (
                      <label
                        className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-600 sm:text-xs"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-brand"
                          checked={exportAssetIds?.has(asset.id) ?? false}
                          onChange={() => onToggleExportAsset(asset.id)}
                          aria-label={`Include ${asset.title ?? asset.original_filename} when sending to Editor`}
                        />
                        Include
                      </label>
                    ) : null}
                  </div>
                </article>
                {showInsertAfter && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-1 top-1 bottom-1 z-20 w-1.5 rounded-full bg-brand shadow-lift"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
