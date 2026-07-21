'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { EditorScopeSwitcher } from '@/components/features/editor-scope-switcher'
import { EditorCanvasSkeleton } from '@/components/features/editor-skeletons'
import { HomepagePlacementCanvas } from '@/components/features/homepage-placement-canvas'
import { useToast } from '@/components/ui/toast'
import { useEditorPlacementBoard, type IEditorPlacementBoard } from '@/hooks/use-editor-curation'
import { useMarkWorkflowViewSeen } from '@/hooks/use-workflow-badges'

/**
 * Placement page: the WYSIWYG homepage canvas, live preview, and publishing.
 *
 * Stories are added by dragging a card from the News page/window directly onto a
 * canvas slot here (native HTML5 drag-and-drop across windows of the same browser).
 *
 * @returns The Placement workflow page.
 */
export default function EditorPlacementPage(): JSX.Element {
  const board = useEditorPlacementBoard()
  useEditorToasts(board.error, board.message)
  useMarkWorkflowViewSeen('placement')

  return (
    <div>
      <PlacementHeader />
      <EditorScopeSwitcher />

      {board.hasUnpublishedPlacements ? (
        <PlacementBanner saving={board.saving} onPublish={board.publishHomepageChanges} />
      ) : null}

      {board.loading ? (
        <div className="mt-6">
          <EditorCanvasSkeleton />
        </div>
      ) : (
        <div className="mt-6">
          <PlacementWorkspace board={board} />
        </div>
      )}
    </div>
  )
}

/**
 * Surface the hook's error/success banners as transient, stackable toasts.
 *
 * @param error Latest error banner text, if any.
 * @param message Latest success banner text, if any.
 */
function useEditorToasts(error: string | null, message: string | null): void {
  const { pushToast } = useToast()
  const previousError = useRef<string | null>(null)
  const previousMessage = useRef<string | null>(null)

  useEffect(() => {
    if (error && error !== previousError.current) {
      pushToast(error, 'error')
    }
    previousError.current = error
  }, [error, pushToast])

  useEffect(() => {
    if (message && message !== previousMessage.current) {
      pushToast(message, 'success')
    }
    previousMessage.current = message
  }, [message, pushToast])
}

function PlacementHeader(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-2xl font-bold">{t('editor.placementPage.heading')}</h1>
      </div>
      <p className="mt-1 text-sm text-neutral-600">{t('editor.placementPage.subtitle')}</p>
    </>
  )
}

interface IPlacementBannerProps {
  saving: boolean
  onPublish: () => void
}

function PlacementBanner({ saving, onPublish }: IPlacementBannerProps): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-900">{t('editor.banner.unpublished')}</p>
      <button
        type="button"
        disabled={saving}
        onClick={() => void onPublish()}
        className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {t('editor.banner.publish')}
      </button>
    </div>
  )
}

function PlacementWorkspace({ board }: { board: IEditorPlacementBoard }): JSX.Element {
  const feed = board.previewFeed
  const slots = board.homepageSlots
  // Drop targets are keyed by layout slot ids. The preview feed can resolve a
  // moment before scoped slots finish loading (especially after Market PR hydrate),
  // which leaves Politics cards non-droppable. Wait until ids overlap.
  const slotsAligned =
    feed != null &&
    slots.length > 0 &&
    feed.slots.some((feedSlot) => slots.some((slot) => slot.id === feedSlot.id))

  return (
    <HomepagePlacementCanvas
      feed={slotsAligned ? feed : null}
      loading={board.previewLoading || board.loading || (feed != null && !slotsAligned)}
      error={board.previewError}
      homepageSlots={slots}
      placementTargets={board.placementTargets}
      selectedArticleId={null}
      saving={board.saving}
      statusMessage={board.message}
      refreshing={board.refreshing}
      onRefresh={() => void board.refreshPreview()}
      onDropPlacement={(articleId, target) => void board.applyDropPlacement(articleId, target)}
      onRemovePlacement={(target) => void board.applyRemovePlacement(target)}
      onMovePlacement={(target, direction) => void board.applyMovePlacement(target, direction)}
    />
  )
}
