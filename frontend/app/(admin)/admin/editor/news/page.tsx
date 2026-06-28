'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { EditorScopeSwitcher } from '@/components/features/editor-scope-switcher'
import { EditorStoryPool } from '@/components/features/editor-story-pool'
import { EditorPoolSkeleton } from '@/components/features/editor-skeletons'
import { useToast } from '@/components/ui/toast'
import { useEditorNews, type IEditorNews } from '@/hooks/use-editor-curation'

/**
 * News page: the article pool and per-story detail editing.
 *
 * Stories are placed by dragging a card from here onto the separate Placement
 * page; this page intentionally has no placement canvas.
 *
 * @returns The News workflow page.
 */
export default function EditorNewsPage(): JSX.Element {
  const news = useEditorNews()
  useEditorToasts(news.error, news.message)
  useUnsavedChangesGuard(news.isDirty)

  return (
    <div>
      <NewsHeader />
      <EditorScopeSwitcher />

      {news.loading ? (
        <div className="mt-6">
          <EditorPoolSkeleton />
        </div>
      ) : (
        <div className="mt-6">
          <EditorStoryPoolSection news={news} />
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

function NewsHeader(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-2xl font-bold">{t('editor.newsPage.heading')}</h1>
      </div>
      <p className="mt-1 text-sm text-neutral-600">{t('editor.newsPage.subtitle')}</p>
    </>
  )
}

function EditorStoryPoolSection({ news }: { news: IEditorNews }): JSX.Element {
  const t = useTranslations('admin')

  /**
   * Load a story, confirming first when discarding unsaved edits.
   *
   * @param articleId Story to open in the detail panel.
   */
  function handleSelect(articleId: string): void {
    const switchingAway = news.selectedId !== null && news.selectedId !== articleId
    if (news.isDirty && switchingAway && !window.confirm(t('editor.guard.discard'))) {
      return
    }
    void news.loadArticleDetail(articleId)
  }

  return (
    <section className="min-w-0 rounded-lg border border-neutral-200 bg-white">
      <EditorArticleIdLoader
        articleIdInput={news.articleIdInput}
        setArticleIdInput={news.setArticleIdInput}
        onLoad={news.loadArticleByIdInput}
      />
      <div className="p-4">
        <EditorStoryPool
          articles={news.articles}
          selectedId={news.selectedId}
          placementMap={news.placementMap}
          onSearch={news.searchArticles}
          onSelect={handleSelect}
          categories={news.categories}
          selectedCategoryIds={news.selectedCategoryIds}
          setSelectedCategoryIds={news.setSelectedCategoryIds}
          internationalPotential={news.internationalPotential}
          setInternationalPotential={news.setInternationalPotential}
          storyId={news.storyId}
          setStoryId={news.setStoryId}
          storyGroups={news.storyGroups}
          detail={news.detail}
          maxImageCount={news.maxImageCount}
          setMaxImageCount={news.setMaxImageCount}
          mediaItems={news.mediaItems}
          setMediaItems={news.setMediaItems}
          saving={news.saving}
          onSave={() => void news.saveArticleChanges()}
          onPublish={() => void news.publishSelected()}
          onDirty={news.markDirty}
          hasMore={news.hasMoreArticles}
          loadingMore={news.loadingMoreArticles}
          onLoadMore={() => void news.loadMoreArticles()}
        />
        {news.articles.length === 0 ? (
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
