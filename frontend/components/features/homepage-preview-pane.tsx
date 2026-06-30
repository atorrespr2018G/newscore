'use client'

import { HomepageContent } from '@/components/features/homepage'
import { PlacementHighlightProvider } from '@/context/editor-placement-context'
import type { IHomepageFeed } from '@/interfaces/feed'
import type { ISlotOut } from '@/lib/api/layout-client'

type HomepagePreviewPaneLayoutType = 'embedded' | 'standalone'

interface IHomepagePreviewPaneProps {
  feed: IHomepageFeed | null
  loading: boolean
  error: string | null
  /**
   * Homepage slots carrying draft/live pins. When supplied, staged-but-unpublished
   * stories are ringed in the preview to mirror the placement canvas.
   */
  homepageSlots?: ISlotOut[]
  layout?: HomepagePreviewPaneLayoutType
  onRefresh?: () => void
  refreshing?: boolean
}

/**
 * Scrollable WYSIWYG homepage preview for the editor workspace.
 *
 * @param props Component props.
 * @returns Preview frame with homepage module stack.
 */
export function HomepagePreviewPane(props: IHomepagePreviewPaneProps): JSX.Element {
  const { feed, loading, error, homepageSlots = [], layout = 'embedded', onRefresh, refreshing = false } = props
  const isStandalone = layout === 'standalone'

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold">Homepage preview</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Includes unpublished stories in pinned slots. Backfill slots still show published content.
            </p>
          </div>
          {onRefresh ? (
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefresh}
              className="rounded border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
            >
              {refreshing ? 'Refreshing…' : 'Refresh preview'}
            </button>
          ) : null}
        </div>
      </header>
      <div
        className={[
          'overflow-y-auto p-4',
          isStandalone ? 'min-h-[calc(100dvh-16rem)]' : 'max-h-[min(70vh,48rem)]',
        ].join(' ')}
      >
        {loading && !feed ? (
          <p className="text-sm text-neutral-500">Loading homepage preview…</p>
        ) : null}
        {error && !feed ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {feed ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-4">
            <PlacementHighlightProvider homepageSlots={homepageSlots}>
              <HomepageContent feed={feed} />
            </PlacementHighlightProvider>
          </div>
        ) : null}
      </div>
    </section>
  )
}
