'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArticleBodyLayout, ArticleHeader } from '@/components/features/article-reading-view'
import { useEditorialArticlePreview } from '@/context/editorial-article-preview-context'
import type { ArticleStatusType } from '@/interfaces/article'

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
  onClose: () => void
}

/**
 * Sticky overlay header with optional unpublished badge and close control.
 *
 * @param props Article status and close handler.
 * @returns The overlay header bar.
 */
function OverlayHeader({ status, onClose }: IOverlayHeaderProps): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-neutral-700">{t('preview.articleRead.heading')}</p>
        {status && status !== 'published' ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
            {t('preview.articleRead.unpublishedBadge', { status })}
          </span>
        ) : null}
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
 * Full-screen read-only article overlay for Placement and Preview.
 *
 * Renders the same layout as the public article page so editors can verify
 * how a story will read before publishing.
 *
 * @returns The overlay dialog, or null when no article is selected.
 */
export function EditorialArticleReadOverlay(): JSX.Element | null {
  const t = useTranslations('admin')
  const preview = useEditorialArticlePreview()
  const isOpen = preview?.isOpen ?? false
  const handleClose = preview?.closePreview ?? (() => undefined)

  useEscapeToClose(isOpen, handleClose)

  if (!preview?.isOpen) {
    return null
  }

  const { articleDetail, selectedArticle, loading, error, closePreview } = preview

  const displayStatus: ArticleStatusType | null =
    articleDetail?.status ?? selectedArticle?.status ?? null

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('preview.articleRead.heading')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePreview()
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-lg bg-white shadow-xl">
        <OverlayHeader status={displayStatus} onClose={closePreview} />
        <div className="site-container px-4 py-8 sm:px-6">
          {loading && !articleDetail ? (
            <p className="text-neutral-600">{t('preview.articleRead.loading')}</p>
          ) : null}
          {error && !articleDetail ? (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {t('preview.articleRead.loadError', { message: error })}
            </p>
          ) : null}
          {articleDetail ? (
            <article>
              <ArticleHeader article={articleDetail} />
              <ArticleBodyLayout article={articleDetail} />
            </article>
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
