'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useEditorScope } from '@/context/editor-scope-context'
import { useEditorStatus } from '@/hooks/use-editor-status'
import { useEditorArticlePool } from '@/hooks/use-editor-article-pool'
import { useArticleDetailEditor } from '@/hooks/use-article-detail-editor'
import { useArticlePlacements } from '@/hooks/use-article-placements'
import type { IEditorNews } from '@/interfaces/editor-article'

/**
 * Orchestrate the News page: article pool, detail editing, and placement labels.
 *
 * The placement canvas is intentionally NOT part of this page; only the per-card
 * placement "location" lookup is loaded so editors can see where each story
 * already sits. Stories leave this page by being dragged onto the Placement page.
 *
 * @returns State and actions consumed by the News page UI.
 */
export function useEditorNews(): IEditorNews {
  const t = useTranslations('admin')
  const scope = useEditorScope()
  const status = useEditorStatus()
  const pool = useEditorArticlePool()
  const detailEditor = useArticleDetailEditor(status, scope, pool.updateArticleRow)
  const { placementMap, loadArticlePlacements } = useArticlePlacements(scope)

  const { setLoading, setError } = status
  useEffect(() => {
    setLoading(true)
    void Promise.all([pool.loadArticles(), loadArticlePlacements()])
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('editor.errors.loadEditorData'))
      })
      .finally(() => setLoading(false))
  }, [pool.loadArticles, loadArticlePlacements, setLoading, setError, t])

  return {
    loading: status.loading,
    error: status.error,
    message: status.message,
    saving: status.saving,
    articles: pool.articles,
    searchArticles: pool.searchArticles,
    hasMoreArticles: pool.hasMoreArticles,
    loadingMoreArticles: pool.loadingMoreArticles,
    loadMoreArticles: pool.loadMoreArticles,
    selectedId: detailEditor.selectedId,
    articleIdInput: detailEditor.articleIdInput,
    setArticleIdInput: detailEditor.setArticleIdInput,
    detail: detailEditor.detail,
    title: detailEditor.title,
    setTitle: detailEditor.setTitle,
    body: detailEditor.body,
    setBody: detailEditor.setBody,
    uploadingMedia: detailEditor.uploadingMedia,
    uploadImages: detailEditor.uploadImages,
    uploadVideos: detailEditor.uploadVideos,
    mediaItems: detailEditor.mediaItems,
    setMediaItems: detailEditor.setMediaItems,
    maxImageCount: detailEditor.maxImageCount,
    setMaxImageCount: detailEditor.setMaxImageCount,
    categories: detailEditor.categories,
    selectedCategoryIds: detailEditor.selectedCategoryIds,
    setSelectedCategoryIds: detailEditor.setSelectedCategoryIds,
    internationalPotential: detailEditor.internationalPotential,
    setInternationalPotential: detailEditor.setInternationalPotential,
    storyId: detailEditor.storyId,
    setStoryId: detailEditor.setStoryId,
    storyGroups: detailEditor.storyGroups,
    isDirty: detailEditor.isDirty,
    markDirty: detailEditor.markDirty,
    loadArticleDetail: detailEditor.loadArticleDetail,
    loadArticleByIdInput: detailEditor.loadArticleByIdInput,
    saveArticleChanges: detailEditor.saveArticleChanges,
    publishSelected: detailEditor.publishSelected,
    publishArticleById: detailEditor.publishArticleById,
    placementMap,
  }
}
