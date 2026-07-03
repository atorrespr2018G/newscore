'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useEditorScope } from '@/context/editor-scope-context'
import { apiConfig } from '@/lib/api/config'
import { getCategories, type ICategoryOut } from '@/lib/api/category-client'
import { getStoryGroups, type IStoryGroupOut } from '@/lib/api/story-group-client'
import { uploadImage, uploadVideo } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'
import {
  buildArticleGalleryMedia,
  galleryItemsToLoadedMedia,
} from '@/lib/helpers/article-media-gallery'
import {
  mapAdminArticleDetailToReadingView,
  type IAdminArticleDetailOut,
} from '@/lib/helpers/admin-article-reading'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import type { IArticleDetail as IReadingArticleDetail } from '@/interfaces/article'
import type { IArticleDetail, ILoadedMedia } from '@/interfaces/editor-article'
import { uploadMediaInto, validateArticleEdits } from '@/lib/helpers/article-detail-editor'

export interface IEditorialArticlePreviewEditor {
  editDetail: IArticleDetail | null
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  body: string
  setBody: Dispatch<SetStateAction<string>>
  uploadingMedia: boolean
  uploadImages: (files: FileList | null) => Promise<void>
  uploadVideos: (files: FileList | null) => Promise<void>
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  maxImageCount: number
  setMaxImageCount: Dispatch<SetStateAction<number>>
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  storyId: string
  setStoryId: Dispatch<SetStateAction<string>>
  storyGroups: IStoryGroupOut[]
  isDirty: boolean
  markDirty: () => void
  saving: boolean
  editError: string | null
  editMessage: string | null
  editLoading: boolean
  loadArticle: (articleId: string) => Promise<IReadingArticleDetail>
  saveChanges: () => Promise<boolean>
  publishArticle: () => Promise<void>
  reset: () => void
}

/**
 * Manage article edit state for the Placement/Preview read overlay.
 *
 * Loads the admin REST detail once per open, populates edit fields, and
 * refreshes the reading view after a successful save or publish.
 *
 * @returns Edit state and actions for the editorial article preview overlay.
 */
export function useEditorialArticlePreviewEditor(): IEditorialArticlePreviewEditor {
  const t = useTranslations('admin')
  const scope = useEditorScope()
  const [editDetail, setEditDetail] = useState<IArticleDetail | null>(null)
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
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const loadRequestIdRef = useRef(0)

  const markDirty = useCallback((): void => {
    setIsDirty(true)
  }, [])

  const refreshStoryGroups = useCallback(async (): Promise<void> => {
    try {
      setStoryGroups(await getStoryGroups())
    } catch {
      // Non-fatal: editors can still type a new story group id.
    }
  }, [])

  useEffect(() => {
    void getCategories()
      .then((items) => setCategories(items))
      .catch((err: unknown) => {
        setEditError(err instanceof Error ? err.message : t('editor.errors.loadCategories'))
      })
    void refreshStoryGroups()
  }, [refreshStoryGroups, t])

  const populateEditFields = useCallback(
    (article: IArticleDetail, galleryItems: ILoadedMedia[], requestId: number): void => {
      if (loadRequestIdRef.current !== requestId) {
        return
      }

      setEditDetail(article)
      setTitle(article.title ?? '')
      setBody(article.body ?? '')
      setMaxImageCount(article.max_image_count)
      setSelectedCategoryIds(article.category_ids ?? [])
      setInternationalPotential(article.international_potential ?? null)
      setStoryId(article.story_id ?? '')
      setMediaItems(galleryItems)
      setIsDirty(false)
      setEditError(null)
      setEditMessage(null)
      setEditLoading(false)
    },
    [],
  )

  const mapRestDetailToEditDetail = useCallback((detail: IAdminArticleDetailOut): IArticleDetail => {
    return {
      id: detail.id,
      title: detail.title,
      body: detail.body,
      status: detail.status,
      media_ids: detail.media_ids ?? [],
      video_url: detail.video_url,
      thumbnail_url: detail.thumbnail_url,
      max_image_count: detail.max_image_count ?? 5,
      category_ids: detail.category_ids ?? [],
      story_id: detail.story_id,
      international_potential: detail.international_potential ?? null,
    }
  }, [])

  const loadArticle = useCallback(
    async (articleId: string): Promise<IReadingArticleDetail> => {
      const requestId = loadRequestIdRef.current + 1
      loadRequestIdRef.current = requestId
      setEditLoading(true)
      setEditError(null)
      setEditMessage(null)
      setEditDetail(null)
      setMediaItems([])

      try {
        const restDetail = await apiFetch<IAdminArticleDetailOut>(
          `${apiConfig.news}/articles/${articleId}`,
        )
        if (loadRequestIdRef.current !== requestId) {
          return mapAdminArticleDetailToReadingView(restDetail, [])
        }

        const galleryItems = await buildArticleGalleryMedia({
          media_ids: restDetail.media_ids,
          thumbnail_url: restDetail.thumbnail_url,
          video_url: restDetail.video_url,
        })
        if (loadRequestIdRef.current !== requestId) {
          return mapAdminArticleDetailToReadingView(restDetail, galleryItems)
        }

        populateEditFields(
          mapRestDetailToEditDetail(restDetail),
          galleryItemsToLoadedMedia(galleryItems),
          requestId,
        )
        return mapAdminArticleDetailToReadingView(restDetail, galleryItems)
      } catch (err) {
        if (loadRequestIdRef.current === requestId) {
          setEditError(err instanceof Error ? err.message : t('editor.errors.loadDetail'))
          setEditLoading(false)
        }
        throw err
      }
    },
    [mapRestDetailToEditDetail, populateEditFields, t],
  )

  const reset = useCallback((): void => {
    loadRequestIdRef.current += 1
    setEditDetail(null)
    setTitle('')
    setBody('')
    setMediaItems([])
    setMaxImageCount(5)
    setSelectedCategoryIds([])
    setInternationalPotential(null)
    setStoryId('')
    setIsDirty(false)
    setSaving(false)
    setEditError(null)
    setEditMessage(null)
    setEditLoading(false)
  }, [])

  const uploadImages = useCallback(
    async (files: FileList | null): Promise<void> => {
      await uploadMediaInto(files, {
        upload: uploadImage,
        setMediaItems,
        setUploadingMedia,
        setError: setEditError,
        setIsDirty,
        errorMessage: t('editor.errors.imageUpload'),
      })
    },
    [t],
  )

  const uploadVideos = useCallback(
    async (files: FileList | null): Promise<void> => {
      await uploadMediaInto(files, {
        upload: uploadVideo,
        setMediaItems,
        setUploadingMedia,
        setError: setEditError,
        setIsDirty,
        errorMessage: t('editor.errors.videoUpload'),
      })
    },
    [t],
  )

  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!editDetail) {
      return false
    }
    if (editLoading) {
      setEditError(t('preview.articleRead.editNotReady'))
      return false
    }
    const validationError = validateArticleEdits(
      { title, body, selectedCategoryIds, uploadingMedia },
      t,
    )
    if (validationError) {
      setEditError(validationError)
      return false
    }

    setSaving(true)
    setEditError(null)
    setEditMessage(null)
    try {
      const firstVideoUrl = mediaItems.find((item) => item.fileType === 'video')?.url ?? ''
      const updated = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${editDetail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim(),
          body,
          media_ids: mediaItems.filter((item) => item.id).map((item) => item.id),
          video_url: firstVideoUrl,
          max_image_count: maxImageCount,
          category_ids: selectedCategoryIds,
          story_id: storyId.trim(),
          international_potential: internationalPotential,
        }),
      })
      setEditDetail(updated)
      setTitle(updated.title ?? '')
      setBody(updated.body ?? '')
      const galleryItems = await buildArticleGalleryMedia({
        media_ids: updated.media_ids,
        thumbnail_url: updated.thumbnail_url,
        video_url: updated.video_url,
      })
      setMediaItems(galleryItemsToLoadedMedia(galleryItems))
      setIsDirty(false)
      setEditMessage(t('editor.status.settingsSaved'))
      void refreshStoryGroups()
      notifyEditorialPreviewStale(scope)
      return true
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('editor.errors.saveArticle'))
      return false
    } finally {
      setSaving(false)
    }
  }, [
    editDetail,
    title,
    body,
    editLoading,
    uploadingMedia,
    mediaItems,
    maxImageCount,
    selectedCategoryIds,
    storyId,
    internationalPotential,
    refreshStoryGroups,
    scope,
    t,
  ])

  const publishArticle = useCallback(async (): Promise<void> => {
    if (!editDetail) {
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      await apiFetch(`${apiConfig.news}/articles/${editDetail.id}/publish`, { method: 'POST' })
      setEditDetail({ ...editDetail, status: 'published' })
      setEditMessage(t('editor.status.articlePublished'))
      notifyEditorialPreviewStale(scope)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('editor.errors.publish'))
    } finally {
      setSaving(false)
    }
  }, [editDetail, scope, t])

  return {
    editDetail,
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
    saving,
    editError,
    editMessage,
    editLoading,
    loadArticle,
    saveChanges,
    publishArticle,
    reset,
  }
}
