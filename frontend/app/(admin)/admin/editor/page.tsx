'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { EditorScopeSwitcher } from '@/components/features/editor-scope-switcher'
import { EditorStoryPool } from '@/components/features/editor-story-pool'
import { EditorCanvasSkeleton, EditorPoolSkeleton } from '@/components/features/editor-skeletons'
import { HomepagePlacementCanvas } from '@/components/features/homepage-placement-canvas'
import { useToast } from '@/components/ui/toast'
import { useEditorScope } from '@/context/editor-scope-context'
import { useEditorPreviewFeed } from '@/hooks/use-editor-preview-feed'
import { useEditorCuration, type IEditorCuration } from '@/hooks/use-editor-curation'
import { subscribeToEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'

const EDITOR_WORKSPACE_HEIGHT_CLASS = 'lg:max-h-[calc(100dvh-14rem)]'
const EDITOR_CANVAS_STICKY_CLASS = 'lg:sticky lg:top-24 lg:self-start'

export default function EditorCurationPage(): JSX.Element {
  const editor = useEditorCuration()
  useEditorToasts(editor.error, editor.message)
  useUnsavedChangesGuard(editor.isDirty)

  return (
    <div>
      <EditorHeader />
      <EditorScopeSwitcher />

      {editor.hasUnpublishedPlacements ? (
        <EditorPlacementBanner saving={editor.saving} onPublish={editor.publishHomepageChanges} />
      ) : null}

      {editor.loading ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <EditorPoolSkeleton />
          <EditorCanvasSkeleton />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <EditorStoryPoolSection editor={editor} />
          <EditorWorkspaceColumn editor={editor} />
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

/**
 * Warn before unloading the tab while the detail panel has unsaved edits.
 *
 * @param isDirty Whether the selected story has pending local changes.
 */
function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) {
      return
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}

function EditorHeader(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-2xl font-bold">{t('editor.heading')}</h1>
      </div>
      <p className="mt-1 text-sm text-neutral-600">{t('editor.subtitle')}</p>
    </>
  )
}

interface IEditorPlacementBannerProps {
  saving: boolean
  onPublish: () => void
}

function EditorPlacementBanner({ saving, onPublish }: IEditorPlacementBannerProps): JSX.Element {
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

function EditorStoryPoolSection({ editor }: { editor: IEditorCuration }): JSX.Element {
  const t = useTranslations('admin')

  /**
   * Load a story, confirming first when discarding unsaved edits.
   *
   * @param articleId Story to open in the detail panel.
   */
  function handleSelect(articleId: string): void {
    const switchingAway = editor.selectedId !== null && editor.selectedId !== articleId
    if (editor.isDirty && switchingAway && !window.confirm(t('editor.guard.discard'))) {
      return
    }
    void editor.loadArticleDetail(articleId)
  }

  return (
    <section className="min-w-0 rounded-lg border border-neutral-200 bg-white">
      <EditorArticleIdLoader
        articleIdInput={editor.articleIdInput}
        setArticleIdInput={editor.setArticleIdInput}
        onLoad={editor.loadArticleByIdInput}
      />
      <div className="p-4">
        <EditorStoryPool
          articles={editor.articles}
          selectedId={editor.selectedId}
          placementMap={editor.placementMap}
          onSearch={editor.searchArticles}
          onSelect={handleSelect}
          categories={editor.categories}
          selectedCategoryIds={editor.selectedCategoryIds}
          setSelectedCategoryIds={editor.setSelectedCategoryIds}
          internationalPotential={editor.internationalPotential}
          setInternationalPotential={editor.setInternationalPotential}
          storyId={editor.storyId}
          setStoryId={editor.setStoryId}
          storyGroups={editor.storyGroups}
          detail={editor.detail}
          maxImageCount={editor.maxImageCount}
          setMaxImageCount={editor.setMaxImageCount}
          mediaItems={editor.mediaItems}
          setMediaItems={editor.setMediaItems}
          saving={editor.saving}
          onSave={() => void editor.saveArticleChanges()}
          onPublish={() => void editor.publishSelected()}
          onDirty={editor.markDirty}
          hasMore={editor.hasMoreArticles}
          loadingMore={editor.loadingMoreArticles}
          onLoadMore={() => void editor.loadMoreArticles()}
        />
        {editor.articles.length === 0 ? (
          <p className="py-8 text-center text-neutral-500">{t('editor.emptyPool')}</p>
        ) : null}
      </div>
    </section>
  )
}

interface IEditorArticleIdLoaderProps {
  articleIdInput: string
  setArticleIdInput: Dispatch<SetStateAction<string>>
  onLoad: () => void
}

function EditorArticleIdLoader({
  articleIdInput,
  setArticleIdInput,
  onLoad,
}: IEditorArticleIdLoaderProps): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
      <label className="min-w-[16rem] flex-1 text-sm font-medium text-neutral-700">
        {t('editor.loadById.label')}
        <input
          type="text"
          value={articleIdInput}
          onChange={(event) => setArticleIdInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onLoad()
            }
          }}
          placeholder={t('editor.loadById.placeholder')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs"
        />
      </label>
      <button
        type="button"
        onClick={onLoad}
        className="rounded border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5"
      >
        {t('editor.loadById.load')}
      </button>
    </div>
  )
}

function EditorWorkspaceColumn({ editor }: { editor: IEditorCuration }): JSX.Element {
  const scope = useEditorScope()
  // The placement canvas renders the resolved homepage feed, so keep it loaded.
  const preview = useEditorPreviewFeed(scope, true)
  const refreshRef = useRef(preview.refresh)
  refreshRef.current = preview.refresh

  // Pull a fresh feed whenever a placement/publish marks the homepage stale so
  // the WYSIWYG placement canvas stays current.
  useEffect(() => {
    return subscribeToEditorialPreviewStale(() => {
      void refreshRef.current()
    })
  }, [])

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${EDITOR_WORKSPACE_HEIGHT_CLASS} ${EDITOR_CANVAS_STICKY_CLASS}`}
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <HomepagePlacementCanvas
          feed={preview.previewFeed}
          loading={preview.loading}
          error={preview.error}
          homepageSlots={editor.homepageSlots}
          placementTargets={editor.placementTargets}
          selectedArticleId={editor.selectedId}
          saving={editor.saving}
          statusMessage={editor.message}
          refreshing={preview.refreshing}
          onRefresh={() => void preview.refresh()}
          onDropPlacement={(articleId, target) => void editor.applyDropPlacement(articleId, target)}
          onRemovePlacement={(target) => void editor.applyRemovePlacement(target)}
          onMovePlacement={(target, direction) => void editor.applyMovePlacement(target, direction)}
        />
      </div>
    </div>
  )
}
