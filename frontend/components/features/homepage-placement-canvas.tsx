'use client'

import { useTranslations } from 'next-intl'
import { HomepageContent } from '@/components/features/homepage'
import { EditorPlacementProvider } from '@/context/editor-placement-context'
import type { IHomepageFeed } from '@/interfaces/feed'
import type { ISlotOut } from '@/lib/api/layout-client'
import type { PlacementMoveDirectionType } from '@/lib/helpers/editor-placement'
import type { IPlacementTarget } from '@/lib/helpers/editor-placement-targets'

interface IHomepagePlacementCanvasProps {
  feed: IHomepageFeed | null
  loading: boolean
  error: string | null
  homepageSlots: ISlotOut[]
  placementTargets: IPlacementTarget[]
  selectedArticleId: string | null
  saving: boolean
  statusMessage: string | null
  refreshing: boolean
  onRefresh: () => void
  onDropPlacement: (articleId: string, target: IPlacementTarget) => void
  onRemovePlacement: (target: IPlacementTarget) => void
  onMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => void
}

/**
 * WYSIWYG homepage placement canvas.
 *
 * Renders the real homepage layout (identical to the preview) wrapped in an
 * editor placement provider so each pinned card becomes a drag/drop, move, and
 * remove target, with per-section drop zones for adding pool stories.
 *
 * @param props Feed, slots, placement targets, selection, and mutation callbacks.
 * @returns The interactive placement canvas.
 */
export function HomepagePlacementCanvas(props: IHomepagePlacementCanvasProps): JSX.Element {
  const {
    feed,
    loading,
    error,
    homepageSlots,
    placementTargets,
    selectedArticleId,
    saving,
    statusMessage,
    refreshing,
    onRefresh,
    onDropPlacement,
    onRemovePlacement,
    onMovePlacement,
  } = props
  const t = useTranslations('admin')

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold">{t('editor.canvas.title')}</h2>
            <p className="mt-1 text-xs text-neutral-500">{t('editor.canvas.description')}</p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefresh}
            className="rounded border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
          >
            {refreshing ? t('editor.canvas.refreshing') : t('editor.canvas.refresh')}
          </button>
        </div>
        {statusMessage ? (
          <p className="mt-2 rounded bg-white px-2 py-1 text-xs text-neutral-600">{statusMessage}</p>
        ) : null}
      </header>
      <div className="p-4">
        {loading && !feed ? (
          <p className="text-sm text-neutral-500">{t('editor.canvas.loading')}</p>
        ) : null}
        {error && !feed ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {feed ? (
          <EditorPlacementProvider
            placementTargets={placementTargets}
            homepageSlots={homepageSlots}
            selectedArticleId={selectedArticleId}
            saving={saving}
            onDropPlacement={onDropPlacement}
            onRemovePlacement={onRemovePlacement}
            onMovePlacement={onMovePlacement}
          >
            <div className="rounded border border-dashed border-neutral-300 bg-white p-4">
              <HomepageContent feed={feed} />
            </div>
          </EditorPlacementProvider>
        ) : null}
      </div>
    </section>
  )
}
