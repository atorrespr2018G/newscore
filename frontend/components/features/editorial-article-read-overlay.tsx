'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArticleBodyLayout, ArticleHeader } from '@/components/features/article-reading-view'
import { EditorArticleEditPanel } from '@/components/features/editor-article-modal'
import { useEditorialArticlePreview } from '@/context/editorial-article-preview-context'
import type { ArticleStatusType } from '@/interfaces/article'

type OverlayModeType = 'preview' | 'edit'

/**
 * Close the overlay on Escape while it is open.
 *
 * @param isOpen Whether the overlay is currently visible.
 * @param onClose Close handler invoked on Escape.
 */
function useEscapeToClose(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
}

interface IOverlayHeaderProps {
  status: ArticleStatusType | null
  mode: OverlayModeType
  onModeChange: (mode: OverlayModeType) => void
  onClose: () => void
}

/**
 * Sticky overlay header with mode tabs, optional unpublished badge, and close.
 *
 * @param props Article status, active mode, and handlers.
 * @returns The overlay header bar.
 */
function OverlayHeader({ status, mode, onModeChange, onClose }: IOverlayHeaderProps): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-neutral-700">{t('preview.articleRead.heading')}</p>
        {status && status !== 'published' ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
            {t('preview.articleRead.unpublishedBadge', { status })}
          </span>
        ) : null}
        <div className="flex rounded border border-neutral-200 p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            onClick={() => onModeChange('preview')}
            className={[
              'rounded px-2.5 py-1 text-xs font-medium',
              mode === 'preview' ? 'bg-brand text-white' : 'text-neutral-600 hover:bg-neutral-50',
            ].join(' ')}
          >
            {t('preview.articleRead.previewTab')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => onModeChange('edit')}
            className={[
              'rounded px-2.5 py-1 text-xs font-medium',
              mode === 'edit' ? 'bg-brand text-white' : 'text-neutral-600 hover:bg-neutral-50',
            ].join(' ')}
          >
            {t('preview.articleRead.editTab')}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('preview.articleRead.closeAria')}
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {t('preview.articleRead.close')}
      </button>
    </div>
  )
}

/**
 * Full-screen article overlay for Placement and Preview with read and edit modes.
 *
 * Editors can preview how a story reads on the site or switch to Edit to change
 * the headline, body, pictures, and videos before publishing placements.
 *
 * @returns The overlay dialog, or null when no article is selected.
 */
export function EditorialArticleReadOverlay(): JSX.Element | null {
  const t = useTranslations('admin')
  const preview = useEditorialArticlePreview()
  const isOpen = preview?.isOpen ?? false

  const handleClose = (): void => {
    if (!preview) {
      return
    }
    if (preview.isDirty && !window.confirm(t('editor.guard.discard'))) {
      return
    }
    preview.closePreview()
  }

  useEscapeToClose(isOpen, handleClose)

  if (!preview?.isOpen) {
    return null
  }

  const {
    articleDetail,
    selectedArticle,
    loading,
    error,
    closePreview,
    mode,
    setMode,
    editDetail,
    title,
    setTitle,
    body,
    setBody,
    uploadImages,
    uploadVideos,
    uploadingMedia,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    internationalPotential,
    setInternationalPotential,
    storyId,
    setStoryId,
    storyGroups,
    maxImageCount,
    setMaxImageCount,
    mediaItems,
    setMediaItems,
    saving,
    isDirty,
    markDirty,
    saveChanges,
    publishArticle,
    editError,
    editMessage,
    editLoading,
  } = preview

  const displayStatus: ArticleStatusType | null =
    (editDetail?.status as ArticleStatusType | undefined) ??
    articleDetail?.status ??
    selectedArticle?.status ??
    null

  /**
   * Switch overlay mode, confirming when leaving Edit with unsaved changes.
   *
   * @param nextMode Target preview or edit mode.
   */
  function handleModeChange(nextMode: OverlayModeType): void {
    if (nextMode === mode) {
      return
    }
    if (mode === 'edit' && isDirty && nextMode === 'preview') {
      if (!window.confirm(t('editor.guard.discard'))) {
        return
      }
    }
    setMode(nextMode)
  }

  async function handleSave(): Promise<void> {
    const saved = await saveChanges()
    if (saved) {
      setMode('preview')
    }
  }

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('preview.articleRead.heading')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-lg bg-white shadow-xl">
        <OverlayHeader
          status={displayStatus}
          mode={mode}
          onModeChange={handleModeChange}
          onClose={handleClose}
        />
        <div className={mode === 'preview' ? 'site-container px-4 py-8 sm:px-6' : ''}>
          {loading && !articleDetail && !editDetail ? (
            <p className="px-4 py-8 text-neutral-600 sm:px-6">{t('preview.articleRead.loading')}</p>
          ) : null}
          {error && !articleDetail && !editDetail ? (
            <p className="mx-4 mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6" role="alert">
              {t('preview.articleRead.loadError', { message: error })}
            </p>
          ) : null}
          {editError ? (
            <p className="mx-4 mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6" role="alert">
              {editError}
            </p>
          ) : null}
          {editMessage ? (
            <p className="mx-4 mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700 sm:mx-6" role="status">
              {editMessage}
            </p>
          ) : null}
          {mode === 'preview' && articleDetail ? (
            <article>
              <ArticleHeader article={articleDetail} />
              <ArticleBodyLayout article={articleDetail} />
            </article>
          ) : null}
          {mode === 'edit' && editLoading ? (
            <p className="px-4 py-8 text-neutral-600 sm:px-6">{t('preview.articleRead.loadingEdit')}</p>
          ) : null}
          {mode === 'edit' && editDetail && !editLoading ? (
            <EditorArticleEditPanel
              onClose={handleClose}
              detail={editDetail}
              title={title}
              setTitle={setTitle}
              body={body}
              setBody={setBody}
              uploadImages={(files) => void uploadImages(files)}
              uploadVideos={(files) => void uploadVideos(files)}
              uploadingMedia={uploadingMedia}
              categories={categories}
              selectedCategoryIds={selectedCategoryIds}
              setSelectedCategoryIds={setSelectedCategoryIds}
              internationalPotential={internationalPotential}
              setInternationalPotential={setInternationalPotential}
              storyId={storyId}
              setStoryId={setStoryId}
              storyGroups={storyGroups}
              maxImageCount={maxImageCount}
              setMaxImageCount={setMaxImageCount}
              mediaItems={mediaItems}
              setMediaItems={setMediaItems}
              saving={saving || editLoading}
              isDirty={isDirty}
              onSave={() => void handleSave()}
              onPublish={() => void publishArticle()}
              onDirty={markDirty}
            />
          ) : null}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return overlay
  }

  return createPortal(overlay, document.body)
}
