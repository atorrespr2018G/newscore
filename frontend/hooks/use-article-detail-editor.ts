'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiConfig } from '@/lib/api/config'
import { getCategories, type ICategoryOut } from '@/lib/api/category-client'
import { getStoryGroups, type IStoryGroupOut } from '@/lib/api/story-group-client'
import { uploadImage, uploadVideo } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'
import {
  buildArticleGalleryMedia,
  galleryItemsToLoadedMedia,
} from '@/lib/helpers/article-media-gallery'
import { uploadMediaInto, validateArticleEdits } from '@/lib/helpers/article-detail-editor'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import type { IEditorScope } from '@/lib/editor/editor-scope'
import type {
  IArticleDetail,
  IArticleDetailEditor,
  IEditorStatus,
  IEditorStoryRow,
  ILoadedMedia,
} from '@/interfaces/editor-article'

/**
 * Manage the selected article's media/publish editing workflow.
 *
 * @param status Shared status banners.
 * @param scope Active editor market/page scope.
 * @param updateArticleRow Patches a single pool row after a write.
 * @returns Detail editing state and actions.
 */
export function useArticleDetailEditor(
  status: IEditorStatus,
  scope: IEditorScope,
  updateArticleRow: (articleId: string, patch: Partial<IEditorStoryRow>) => void,
): IArticleDetailEditor {
  const t = useTranslations('admin')
  const { setError, setMessage, setSaving } = status
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [articleIdInput, setArticleIdInput] = useState('')
  const [detail, setDetail] = useState<IArticleDetail | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaItems, setMediaItems] = useState<ILoadedMedia[]>([])
  const [maxImageCount, setMaxImageCount] = useState(5)
  const [categories, setCategories] = useState<ICategoryOut[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [internationalPotential, setInternationalPotential] = useState<number | null>(null)
  const [storyId, setStoryId] = useState('')
  const [storyGroups, setStoryGroups] = useState<IStoryGroupOut[]>([])
  const [isDirty, setIsDirty] = useState(false)

  // Edits to taxonomy/media/rating happen in local state; flag them so the UI
  // can warn before the changes are silently discarded by a new selection.
  const markDirty = useCallback(() => setIsDirty(true), [])

  useEffect(() => {
    void getCategories()
      .then((items) => setCategories(items))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('editor.errors.loadCategories'))
      })
  }, [setError, t])

  // Refresh the story group list so a newly created id appears in the combobox
  // after the next save; failures are non-fatal and leave the prior list intact.
  const refreshStoryGroups = useCallback(async () => {
    try {
      setStoryGroups(await getStoryGroups())
    } catch {
      // Keep the existing groups; the editor can still type a new id.
    }
  }, [])

  useEffect(() => {
    void refreshStoryGroups()
  }, [refreshStoryGroups])

  const loadArticleDetail = useCallback(
    async (articleId: string) => {
      setError(null)
      setMessage(null)
      setSelectedId(articleId)
      setArticleIdInput(articleId)
      try {
        const article = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
        setDetail(article)
        setTitle(article.title ?? '')
        setBody(article.body ?? '')
        setMaxImageCount(article.max_image_count)
        setSelectedCategoryIds(article.category_ids ?? [])
        setInternationalPotential(article.international_potential ?? null)
        setStoryId(article.story_id ?? '')
        const galleryItems = await buildArticleGalleryMedia({
          media_ids: article.media_ids,
          thumbnail_url: article.thumbnail_url,
          video_url: article.video_url,
        })
        setMediaItems(galleryItemsToLoadedMedia(galleryItems))
        setIsDirty(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('editor.errors.loadDetail'))
      }
    },
    [setError, setMessage, t],
  )

  const loadArticleByIdInput = useCallback(() => {
    const trimmedId = articleIdInput.trim()
    if (!trimmedId) {
      setError(t('editor.loadById.empty'))
      return
    }
    void loadArticleDetail(trimmedId)
  }, [articleIdInput, loadArticleDetail, setError, t])

  // Append newly uploaded images to the gallery and flag the edit as dirty so
  // the unsaved-changes guard and Save button reflect the pending media.
  const uploadImages = useCallback(
    async (files: FileList | null) => {
      await uploadMediaInto(files, {
        upload: uploadImage,
        setMediaItems,
        setUploadingMedia,
        setError,
        setIsDirty,
        errorMessage: t('editor.errors.imageUpload'),
      })
    },
    [setError, t],
  )

  const uploadVideos = useCallback(
    async (files: FileList | null) => {
      await uploadMediaInto(files, {
        upload: uploadVideo,
        setMediaItems,
        setUploadingMedia,
        setError,
        setIsDirty,
        errorMessage: t('editor.errors.videoUpload'),
      })
    },
    [setError, t],
  )

  const saveArticleChanges = useCallback(async (): Promise<boolean> => {
    if (!detail) {
      return false
    }
    const validationError = validateArticleEdits({ title, body, selectedCategoryIds, uploadingMedia }, t)
    if (validationError) {
      setError(validationError)
      return false
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      // The lead video (used by story cards/hero) is the first video in the
      // gallery; the public detail gallery shows every video in media_ids too.
      const firstImageUrl = mediaItems.find((item) => item.fileType === 'image')?.url ?? null
      const firstVideoUrl = mediaItems.find((item) => item.fileType === 'video')?.url ?? ''
      const updated = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim(),
          body,
          // Persist images and videos together in gallery order; the backend
          // derives the thumbnail from the first image and caps only images.
          media_ids: mediaItems.filter((item) => item.id).map((item) => item.id),
          // Empty string clears the lead video; the PATCH layer drops null but
          // keeps an empty string, so this is how the last video is removed.
          video_url: firstVideoUrl,
          max_image_count: maxImageCount,
          category_ids: selectedCategoryIds,
          // Send the trimmed id (empty string clears the group); the PATCH layer
          // drops null but keeps an empty string, so this is how unassign works.
          story_id: storyId.trim(),
          international_potential: internationalPotential,
        }),
      })
      setDetail(updated)
      setTitle(updated.title ?? '')
      setBody(updated.body ?? '')
      const galleryItems = await buildArticleGalleryMedia({
        media_ids: updated.media_ids,
        thumbnail_url: updated.thumbnail_url,
        video_url: updated.video_url,
      })
      setMediaItems(galleryItemsToLoadedMedia(galleryItems))
      setIsDirty(false)
      setMessage(t('editor.status.settingsSaved'))
      updateArticleRow(updated.id, {
        title: updated.title,
        status: updated.status,
        thumbnail_url: firstImageUrl,
      })
      void refreshStoryGroups()
      notifyEditorialPreviewStale(scope)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.errors.saveArticle'))
      return false
    } finally {
      setSaving(false)
    }
  }, [
    detail,
    title,
    body,
    uploadingMedia,
    mediaItems,
    maxImageCount,
    selectedCategoryIds,
    storyId,
    internationalPotential,
    updateArticleRow,
    refreshStoryGroups,
    scope,
    setError,
    setMessage,
    setSaving,
    t,
  ])

  const publishSelected = useCallback(async () => {
    if (!detail) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`${apiConfig.news}/articles/${detail.id}/publish`, { method: 'POST' })
      setMessage(t('editor.status.articlePublished'))
      setDetail({ ...detail, status: 'published' })
      updateArticleRow(detail.id, { status: 'published' })
      notifyEditorialPreviewStale(scope)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.errors.publish'))
    } finally {
      setSaving(false)
    }
  }, [detail, updateArticleRow, scope, setError, setMessage, setSaving, t])

  const publishArticleById = useCallback(
    async (articleId: string) => {
      setSaving(true)
      setError(null)
      try {
        await apiFetch(`${apiConfig.news}/articles/${articleId}/publish`, { method: 'POST' })
        setMessage(t('editor.status.placedAndPublished'))
        updateArticleRow(articleId, { status: 'published' })
        // Keep the open detail in sync when it is the story we just published.
        setDetail((current) =>
          current && current.id === articleId ? { ...current, status: 'published' } : current,
        )
        notifyEditorialPreviewStale(scope)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('editor.errors.publishPlaced'))
      } finally {
        setSaving(false)
      }
    },
    [updateArticleRow, scope, setDetail, setError, setMessage, setSaving, t],
  )

  return {
    selectedId,
    articleIdInput,
    setArticleIdInput,
    detail,
    setDetail,
    title,
    setTitle,
    body,
    setBody,
    uploadingMedia,
    uploadImages,
    uploadVideos,
    mediaItems,
    setMediaItems,
    maxImageCount,
    setMaxImageCount,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    internationalPotential,
    setInternationalPotential,
    storyId,
    setStoryId,
    storyGroups,
    isDirty,
    markDirty,
    loadArticleDetail,
    loadArticleByIdInput,
    saveArticleChanges,
    publishSelected,
    publishArticleById,
  }
}
