'use client'

import { DragEvent, PointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { IMediaAsset, IMediaStory } from '@/lib/media-editor-client'
import {
  getPreferredVersion,
  getRootId,
  IDragPayload,
  readDragPayload,
  removeFromSelected,
  sanitizePoolIds,
  selectFromPool,
  writeDragPayload,
} from '@/lib/story-selection'

const DRAG_THRESHOLD_PX = 6

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
  poolUploadControl: ReactNode
  onSelectAsset: (asset: IMediaAsset) => void
  onEditImage: (asset: IMediaAsset) => void
  onRemoveBackground: (asset: IMediaAsset) => void
  onDeleteAsset: (asset: IMediaAsset) => void
  onStoryChange: (story: IMediaStory) => Promise<void>
  onError: (message: string) => void
  removingBackground?: boolean
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
  poolUploadControl,
  onSelectAsset,
  onEditImage,
  onRemoveBackground,
  onDeleteAsset,
  onStoryChange,
  onError,
  removingBackground = false,
}: IStoryWorkspaceProps): JSX.Element {
  const [dropHint, setDropHint] = useState<'pool' | 'selected' | null>(null)
  const [dragPayload, setDragPayload] = useState<IDragPayload | null>(null)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
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
  onErrorRef.current = onError
  onStoryChangeRef.current = onStoryChange

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

  function resolveRootId(assetId: string): string {
    const asset = assetsByIdRef.current.get(assetId)
    if (!asset) throw new Error(`Asset ${assetId} was not found`)
    return getRootId(asset, assetsByIdRef.current)
  }

  function applyDrop(payload: IDragPayload, zone: 'pool' | 'selected'): void {
    const currentStory = storyRef.current
    const currentPool = poolRootIdsRef.current
    try {
      if (zone === 'selected' && payload.source === 'pool') {
        const next = selectFromPool(
          currentPool,
          currentStory.selected_asset_ids,
          payload.rootId,
          payload.assetId,
          undefined,
          resolveRootId,
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
        return
      }
      if (zone === 'pool' && payload.source === 'selected') {
        void persist({
          ...currentStory,
          pool_asset_ids: currentPool,
          selected_asset_ids: removeFromSelected(currentStory.selected_asset_ids, payload.assetId),
          status: 'draft',
        })
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Drop failed')
    }
  }

  function addPoolAssetToReport(asset: IMediaAsset): void {
    const rootId = getRootId(asset, assetsById)
    try {
      const next = selectFromPool(
        poolRootIds,
        story.selected_asset_ids,
        rootId,
        asset.id,
        undefined,
        resolveRootId,
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
      setDropHint(zoneAtPoint(event.clientX, event.clientY))
    }

    function onPointerUp(event: globalThis.PointerEvent): void {
      const active = activeDragRef.current
      const wasDragging = Boolean(active)
      dragOrigin.current = null
      activeDragRef.current = null
      if (active) {
        const zone = zoneAtPoint(event.clientX, event.clientY)
        if (zone) applyDrop(active, zone)
        else if (active.source === 'pool') {
          // Fallback when release lands just outside the report card (stacked or side-by-side).
          const poolBox = poolPaneRef.current?.getBoundingClientRect()
          const reportBox = reportPaneRef.current?.getBoundingClientRect()
          if (
            poolBox
            && reportBox
            && (event.clientY > poolBox.bottom - 8 || event.clientX > poolBox.right - 8)
          ) {
            applyDrop(active, 'selected')
          }
        }
      }
      setDragPayload(null)
      setDragPoint(null)
      setDropHint(null)
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

  const poolCards = poolRootIds
    .map((rootId) => {
      try {
        return { rootId, asset: getPreferredVersion(rootId, assets, story.selected_asset_ids) }
      } catch {
        const asset = assetsById.get(rootId) ?? null
        return asset ? { rootId, asset } : null
      }
    })
    .filter((card): card is { rootId: string; asset: IMediaAsset } => Boolean(card))

  const selectedCards = story.selected_asset_ids
    .map((id) => {
      const asset = assetsById.get(id) ?? null
      if (!asset) return null
      return { rootId: getRootId(asset, assetsById), asset }
    })
    .filter((card): card is { rootId: string; asset: IMediaAsset } => Boolean(card))

  const selectedRootId = selectedAssetId
    ? (() => {
        const selected = assetsById.get(selectedAssetId)
        return selected ? getRootId(selected, assetsById) : null
      })()
    : null

  const reportTarget = selectedCards.find(
    (card) => card.asset.id === selectedAssetId || card.rootId === selectedRootId,
  )?.asset ?? null

  const poolTarget = poolCards.find(
    (card) => card.asset.id === selectedAssetId || card.rootId === selectedRootId,
  )?.asset ?? null

  const draggedAsset = dragPayload
    ? assetsById.get(dragPayload.assetId) ?? null
    : null

  function beginDrag(event: PointerEvent<HTMLElement>, payload: IDragPayload): void {
    if (event.button !== 0) return
    // Avoid setPointerCapture — it can trap move/up inside the card and break drops.
    suppressClickRef.current = false
    dragOrigin.current = { x: event.clientX, y: event.clientY, payload }
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
      applyDrop(payload, zone)
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
        subtitle="Select a picture, then Add to report — or drag it into the report list"
        emptyLabel="Use Add pictures above to load originals for this story"
        cards={poolCards}
        selectedAssetId={selectedAssetId}
        selectedRootId={selectedRootId}
        dragSource="pool"
        highlight={dropHint === 'pool'}
        toolbar={
          <>
            {poolUploadControl}
            <PoolPictureActions
              asset={poolTarget}
              alreadyInReport={Boolean(
                poolTarget
                && selectedCards.some((card) => card.rootId === getRootId(poolTarget, assetsById)),
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
        subtitle="Drop originals here, or use Add to report. Select a picture for the actions below."
        emptyLabel="Drop pictures here from the originals pool"
        cards={selectedCards}
        selectedAssetId={selectedAssetId}
        selectedRootId={selectedRootId}
        dragSource="selected"
        highlight={dropHint === 'selected'}
        showOrder
        toolbar={
          <ReportPictureActions
            asset={reportTarget}
            removingBackground={removingBackground}
            onEditImage={onEditImage}
            onRemoveBackground={onRemoveBackground}
            onRemoveFromReport={(assetId) => {
              void persist({
                ...story,
                pool_asset_ids: poolRootIds,
                selected_asset_ids: removeFromSelected(story.selected_asset_ids, assetId),
                status: 'draft',
              })
            }}
          />
        }
        onSelectAsset={handleCardClick}
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
          className="pointer-events-none fixed z-50 w-40 rounded-xl border border-brand bg-white px-2 py-2 shadow-lift"
          style={{ left: dragPoint.x + 12, top: dragPoint.y + 12 }}
        >
          <p className="truncate text-xs font-semibold text-brand-ink">
            {draggedAsset.title ?? draggedAsset.original_filename}
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
            {dragPayload.source === 'pool' ? 'To report' : 'Drag to originals to remove'}
          </p>
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
          Delete original
        </button>
      </div>
    </div>
  )
}

interface IReportPictureActionsProps {
  asset: IMediaAsset | null
  removingBackground: boolean
  onEditImage: (asset: IMediaAsset) => void
  onRemoveBackground: (asset: IMediaAsset) => void
  onRemoveFromReport: (assetId: string) => void
}

/** Report-only actions: edit, remove background, or remove from report (original stays). */
function ReportPictureActions({
  asset,
  removingBackground,
  onEditImage,
  onRemoveBackground,
  onRemoveFromReport,
}: IReportPictureActionsProps): JSX.Element {
  const enabled = Boolean(asset)
  const isImage = asset?.file_type === 'image'

  return (
    <div className="mb-4 rounded-xl border border-brand-line bg-brand-paper px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Picture actions
        </p>
        <p className="truncate text-xs text-slate-500">
          {asset
            ? `Selected: ${asset.title ?? asset.original_filename}`
            : 'Select a picture in the report list'}
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
}

interface ICollectionPaneProps {
  paneRef: React.MutableRefObject<HTMLElement | null>
  className?: string
  title: string
  subtitle: string
  emptyLabel: string
  cards: IStoryCard[]
  selectedAssetId: string | null
  selectedRootId: string | null
  dragSource: 'pool' | 'selected'
  highlight: boolean
  showOrder?: boolean
  toolbar?: ReactNode
  onSelectAsset: (asset: IMediaAsset) => void
  onCardPointerDown: (event: PointerEvent<HTMLElement>, payload: IDragPayload) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

/** One story collection pane with HTML5 + pointer drag cards. */
function CollectionPane({
  paneRef,
  className = '',
  title,
  subtitle,
  emptyLabel,
  cards,
  selectedAssetId,
  selectedRootId,
  dragSource,
  highlight,
  showOrder = false,
  toolbar,
  onSelectAsset,
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
        <ul className="flex flex-row gap-3 overflow-x-auto pb-1">
          {cards.map(({ rootId, asset }, index) => {
            const active = asset.id === selectedAssetId || selectedRootId === rootId
            const hasEdits = Boolean(asset.version_of)
            return (
              <li key={`${dragSource}-${rootId}`} className="w-40 shrink-0">
                <article
                  draggable
                  className={`flex h-full cursor-grab touch-none flex-col overflow-hidden rounded-xl border bg-white active:cursor-grabbing select-none ${
                    active ? 'border-brand shadow-lift ring-2 ring-brand/15' : 'border-brand-line hover:border-slate-300'
                  }`}
                  onClick={() => onSelectAsset(asset)}
                  onDragStart={(event) => {
                    writeDragPayload(event.dataTransfer, {
                      assetId: asset.id,
                      rootId,
                      source: dragSource,
                    })
                  }}
                  onPointerDown={(event) => {
                    onCardPointerDown(event, {
                      assetId: asset.id,
                      rootId,
                      source: dragSource,
                    })
                  }}
                >
                  <div className="relative h-28 w-full overflow-hidden bg-brand-mist">
                    {asset.file_type === 'image' ? (
                      <img
                        alt={asset.alt_text ?? asset.original_filename}
                        className="pointer-events-none h-full w-full object-cover"
                        draggable={false}
                        src={asset.preview_url ?? asset.url}
                      />
                    ) : (
                      <video
                        className="pointer-events-none h-full w-full object-cover"
                        draggable={false}
                        muted
                        src={asset.url}
                      />
                    )}
                    {showOrder && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-brand-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 px-2.5 py-2">
                    <p className="truncate text-sm font-semibold text-brand-ink">
                      {asset.title ?? asset.original_filename}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {hasEdits ? 'Edited' : asset.file_type}
                      {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                      {active ? ' · selected' : ''}
                    </p>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
