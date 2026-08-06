'use client'

import { DragEvent, ReactNode, useMemo, useState } from 'react'
import { IMediaAsset, IMediaStory } from '@/lib/media-editor-client'
import {
  getPreferredVersion,
  getRootId,
  readDragPayload,
  removeFromSelected,
  reorderSelected,
  sanitizePoolIds,
  selectFromPool,
  writeDragPayload,
} from '@/lib/story-selection'

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
}

/**
 * Reporter board: drag originals into the ordered report collection.
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
}: IStoryWorkspaceProps): JSX.Element {
  const [dropHint, setDropHint] = useState<'pool' | 'selected' | null>(null)
  const poolRootIds = useMemo(
    () => sanitizePoolIds(story.pool_asset_ids, assetsById),
    [story.pool_asset_ids, assetsById],
  )

  async function persist(next: IMediaStory): Promise<void> {
    try {
      await onStoryChange(next)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to update story collections')
    }
  }

  function resolveRootId(assetId: string): string {
    const asset = assetsById.get(assetId)
    if (!asset) throw new Error(`Asset ${assetId} was not found`)
    return getRootId(asset)
  }

  function handlePoolDrop(event: DragEvent<HTMLElement>): void {
    event.preventDefault()
    setDropHint(null)
    const payload = readDragPayload(event.dataTransfer)
    if (!payload || payload.source !== 'selected') return
    void persist({
      ...story,
      pool_asset_ids: poolRootIds,
      selected_asset_ids: removeFromSelected(story.selected_asset_ids, payload.assetId),
      status: 'draft',
    })
  }

  function handleSelectedDrop(event: DragEvent<HTMLElement>, insertIndex?: number): void {
    event.preventDefault()
    event.stopPropagation()
    setDropHint(null)
    const payload = readDragPayload(event.dataTransfer)
    if (!payload) return
    try {
      if (payload.source === 'pool') {
        const next = selectFromPool(
          poolRootIds,
          story.selected_asset_ids,
          payload.rootId,
          payload.assetId,
          insertIndex,
          resolveRootId,
        )
        void persist({
          ...story,
          pool_asset_ids: next.poolIds,
          selected_asset_ids: next.selectedIds,
          status: 'draft',
        })
        return
      }
      const nextSelected = reorderSelected(
        story.selected_asset_ids,
        payload.assetId,
        insertIndex ?? story.selected_asset_ids.length,
      )
      void persist({
        ...story,
        pool_asset_ids: poolRootIds,
        selected_asset_ids: nextSelected,
        status: 'draft',
      })
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Drop failed')
    }
  }

  const poolCards = poolRootIds.map((rootId) => {
    try {
      return getPreferredVersion(rootId, assets, story.selected_asset_ids)
    } catch {
      return assetsById.get(rootId) ?? null
    }
  }).filter((asset): asset is IMediaAsset => Boolean(asset))

  const selectedCards = story.selected_asset_ids
    .map((id) => assetsById.get(id) ?? null)
    .filter((asset): asset is IMediaAsset => Boolean(asset))

  const selectedRootId = selectedAssetId
    ? (() => {
        const selected = assetsById.get(selectedAssetId)
        return selected ? getRootId(selected) : null
      })()
    : null

  const reportTarget = selectedCards.find(
    (asset) => asset.id === selectedAssetId || getRootId(asset) === selectedRootId,
  ) ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CollectionPane
        title="All pictures for this news"
        subtitle="One thumbnail per picture — edits update that thumbnail, they do not add new originals"
        emptyLabel="Use Add pictures above to load originals for this story"
        cards={poolCards}
        selectedAssetId={selectedAssetId}
        selectedRootId={selectedRootId}
        dragSource="pool"
        highlight={dropHint === 'pool'}
        toolbar={poolUploadControl}
        onSelectAsset={onSelectAsset}
        onDragOver={(event) => {
          event.preventDefault()
          setDropHint('pool')
        }}
        onDragLeave={() => setDropHint(null)}
        onDrop={handlePoolDrop}
      />
      <CollectionPane
        title="Pictures for the report"
        subtitle="Select a picture, then use the actions below. Drag to reorder."
        emptyLabel="Drag pictures here from the originals pool"
        cards={selectedCards}
        selectedAssetId={selectedAssetId}
        selectedRootId={selectedRootId}
        dragSource="selected"
        highlight={dropHint === 'selected'}
        showOrder
        toolbar={
          <ReportPictureActions
            asset={reportTarget}
            onEditImage={onEditImage}
            onRemoveBackground={onRemoveBackground}
            onDeleteAsset={onDeleteAsset}
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
        onSelectAsset={onSelectAsset}
        onDragOver={(event) => {
          event.preventDefault()
          setDropHint('selected')
        }}
        onDragLeave={() => setDropHint(null)}
        onDrop={(event) => handleSelectedDrop(event)}
        onDropAtIndex={(event, index) => handleSelectedDrop(event, index)}
      />
    </div>
  )
}

interface IReportPictureActionsProps {
  asset: IMediaAsset | null
  onEditImage: (asset: IMediaAsset) => void
  onRemoveBackground: (asset: IMediaAsset) => void
  onDeleteAsset: (asset: IMediaAsset) => void
  onRemoveFromReport: (assetId: string) => void
}

/**
 * Single action menu for the selected report-order picture.
 * @param props - Selected report asset and picture-action callbacks.
 * @returns Shared edit/remove/delete controls for the report collection.
 */
function ReportPictureActions({
  asset,
  onEditImage,
  onRemoveBackground,
  onDeleteAsset,
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
          disabled={!enabled || !isImage}
          onClick={() => asset && onRemoveBackground(asset)}
        >
          Remove background
        </button>
        <button
          type="button"
          className="me-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!enabled}
          onClick={() => asset && onRemoveFromReport(asset.id)}
        >
          Remove from report
        </button>
        <button
          type="button"
          className="me-btn-danger px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!enabled}
          onClick={() => asset && onDeleteAsset(asset)}
        >
          Delete picture
        </button>
      </div>
    </div>
  )
}

interface ICollectionPaneProps {
  title: string
  subtitle: string
  emptyLabel: string
  cards: IMediaAsset[]
  selectedAssetId: string | null
  selectedRootId: string | null
  dragSource: 'pool' | 'selected'
  highlight: boolean
  showOrder?: boolean
  toolbar?: ReactNode
  onSelectAsset: (asset: IMediaAsset) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  onDropAtIndex?: (event: DragEvent<HTMLElement>, index: number) => void
}

/** One story collection pane with HTML5 drag-and-drop cards. */
function CollectionPane({
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
  onDragOver,
  onDragLeave,
  onDrop,
  onDropAtIndex,
}: ICollectionPaneProps): JSX.Element {
  return (
    <section
      className={`me-panel min-h-[320px] p-4 md:p-5 ${highlight ? 'ring-2 ring-brand/30 border-brand/40' : ''}`}
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
        <ul className="space-y-2">
          {cards.map((asset, index) => {
            const rootId = getRootId(asset)
            const active = asset.id === selectedAssetId || selectedRootId === rootId
            const hasEdits = Boolean(asset.version_of)
            return (
              <li key={`${dragSource}-${rootId}`}>
                {onDropAtIndex && <DropSlot onDrop={(event) => onDropAtIndex(event, index)} />}
                <article
                  draggable
                  onDragStart={(event) => {
                    writeDragPayload(event.dataTransfer, {
                      assetId: asset.id,
                      rootId,
                      source: dragSource,
                    })
                  }}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-2 ${
                    active ? 'border-brand shadow-lift ring-2 ring-brand/15' : 'border-brand-line hover:border-slate-300'
                  }`}
                  onClick={() => onSelectAsset(asset)}
                >
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-mist">
                    {asset.file_type === 'image' ? (
                      <img
                        alt={asset.alt_text ?? asset.original_filename}
                        className="h-full w-full object-cover"
                        src={asset.preview_url ?? asset.url}
                      />
                    ) : (
                      <video className="h-full w-full object-cover" muted src={asset.url} />
                    )}
                    {showOrder && (
                      <span className="absolute left-1 top-1 rounded bg-brand-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
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
          {onDropAtIndex && <DropSlot onDrop={(event) => onDropAtIndex(event, cards.length)} />}
        </ul>
      )}
    </section>
  )
}

interface IDropSlotProps {
  onDrop: (event: DragEvent<HTMLDivElement>) => void
}

/** Thin drop target between ordered report cards. */
function DropSlot({ onDrop }: IDropSlotProps): JSX.Element {
  return (
    <div
      className="h-2 rounded-full transition hover:bg-brand/20"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    />
  )
}
