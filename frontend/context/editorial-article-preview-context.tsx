'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useEditorialArticlePreviewEditor } from '@/hooks/use-editorial-article-preview-editor'
import type { IArticle, IArticleDetail } from '@/interfaces/article'
import { fetchAdminArticleForReading } from '@/lib/helpers/admin-article-reading'

type OverlayModeType = 'preview' | 'edit'

interface IEditorialArticlePreviewContextValue {
  selectedArticle: IArticle | null
  articleDetail: IArticleDetail | null
  loading: boolean
  error: string | null
  isOpen: boolean
  mode: OverlayModeType
  setMode: (mode: OverlayModeType) => void
  openPreview: (article: IArticle) => void
  closePreview: () => void
  editDetail: ReturnType<typeof useEditorialArticlePreviewEditor>['editDetail']
  title: string
  setTitle: ReturnType<typeof useEditorialArticlePreviewEditor>['setTitle']
  body: string
  setBody: ReturnType<typeof useEditorialArticlePreviewEditor>['setBody']
  uploadingMedia: boolean
  uploadImages: ReturnType<typeof useEditorialArticlePreviewEditor>['uploadImages']
  uploadVideos: ReturnType<typeof useEditorialArticlePreviewEditor>['uploadVideos']
  mediaItems: ReturnType<typeof useEditorialArticlePreviewEditor>['mediaItems']
  setMediaItems: ReturnType<typeof useEditorialArticlePreviewEditor>['setMediaItems']
  maxImageCount: number
  setMaxImageCount: ReturnType<typeof useEditorialArticlePreviewEditor>['setMaxImageCount']
  categories: ReturnType<typeof useEditorialArticlePreviewEditor>['categories']
  selectedCategoryIds: string[]
  setSelectedCategoryIds: ReturnType<typeof useEditorialArticlePreviewEditor>['setSelectedCategoryIds']
  internationalPotential: number | null
  setInternationalPotential: ReturnType<typeof useEditorialArticlePreviewEditor>['setInternationalPotential']
  storyId: string
  setStoryId: ReturnType<typeof useEditorialArticlePreviewEditor>['setStoryId']
  storyGroups: ReturnType<typeof useEditorialArticlePreviewEditor>['storyGroups']
  isDirty: boolean
  markDirty: () => void
  saving: boolean
  editError: string | null
  editMessage: string | null
  editLoading: boolean
  saveChanges: () => Promise<boolean>
  publishArticle: () => Promise<void>
  refreshReadingDetail: () => Promise<void>
}

const EditorialArticlePreviewContext = createContext<IEditorialArticlePreviewContextValue | null>(null)

interface IEditorialArticlePreviewProviderProps {
  children: ReactNode
}

/**
 * Provide editorial article preview and edit state for Placement and Preview.
 *
 * @param props Child tree that can open the overlay via story card clicks.
 * @returns Provider wrapping the admin preview homepage.
 */
export function EditorialArticlePreviewProvider({
  children,
}: IEditorialArticlePreviewProviderProps): JSX.Element {
  const editor = useEditorialArticlePreviewEditor()
  const { reset, loadArticle, saveChanges: saveEditorChanges, publishArticle: publishEditorArticle, ...editorFields } = editor
  const [selectedArticle, setSelectedArticle] = useState<IArticle | null>(null)
  const [articleDetail, setArticleDetail] = useState<IArticleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<OverlayModeType>('preview')
  const requestIdRef = useRef(0)

  const refreshReadingDetail = useCallback(async (): Promise<void> => {
    if (!selectedArticle) {
      return
    }
    const detail = await fetchAdminArticleForReading(selectedArticle.id)
    setArticleDetail(detail)
  }, [selectedArticle])

  const closePreview = useCallback((): void => {
    requestIdRef.current += 1
    setSelectedArticle(null)
    setArticleDetail(null)
    setLoading(false)
    setError(null)
    setMode('preview')
    reset()
  }, [reset])

  const openPreview = useCallback(
    (article: IArticle): void => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setSelectedArticle(article)
      setArticleDetail(null)
      setLoading(true)
      setError(null)
      setMode('preview')

      void loadArticle(article.id)
        .then((detail) => {
          if (requestIdRef.current !== requestId) {
            return
          }
          setArticleDetail(detail)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (requestIdRef.current !== requestId) {
            return
          }
          setError(err instanceof Error ? err.message : 'Failed to load article')
          setLoading(false)
        })
    },
    [loadArticle],
  )

  const saveChanges = useCallback(async (): Promise<boolean> => {
    const saved = await saveEditorChanges()
    if (saved) {
      await refreshReadingDetail()
    }
    return saved
  }, [saveEditorChanges, refreshReadingDetail])

  const publishArticle = useCallback(async (): Promise<void> => {
    await publishEditorArticle()
    await refreshReadingDetail()
  }, [publishEditorArticle, refreshReadingDetail])

  const value: IEditorialArticlePreviewContextValue = {
    selectedArticle,
    articleDetail,
    loading,
    error,
    isOpen: selectedArticle !== null,
    mode,
    setMode,
    openPreview,
    closePreview,
    editDetail: editorFields.editDetail,
    title: editorFields.title,
    setTitle: editorFields.setTitle,
    body: editorFields.body,
    setBody: editorFields.setBody,
    uploadingMedia: editorFields.uploadingMedia,
    uploadImages: editorFields.uploadImages,
    uploadVideos: editorFields.uploadVideos,
    mediaItems: editorFields.mediaItems,
    setMediaItems: editorFields.setMediaItems,
    maxImageCount: editorFields.maxImageCount,
    setMaxImageCount: editorFields.setMaxImageCount,
    categories: editorFields.categories,
    selectedCategoryIds: editorFields.selectedCategoryIds,
    setSelectedCategoryIds: editorFields.setSelectedCategoryIds,
    internationalPotential: editorFields.internationalPotential,
    setInternationalPotential: editorFields.setInternationalPotential,
    storyId: editorFields.storyId,
    setStoryId: editorFields.setStoryId,
    storyGroups: editorFields.storyGroups,
    isDirty: editorFields.isDirty,
    markDirty: editorFields.markDirty,
    saving: editorFields.saving,
    editError: editorFields.editError,
    editMessage: editorFields.editMessage,
    editLoading: editorFields.editLoading,
    saveChanges,
    publishArticle,
    refreshReadingDetail,
  }

  return (
    <EditorialArticlePreviewContext.Provider value={value}>
      {children}
    </EditorialArticlePreviewContext.Provider>
  )
}

/**
 * Read editorial article preview state when inside a preview provider.
 *
 * @returns Preview context value, or null outside a provider.
 */
export function useEditorialArticlePreview(): IEditorialArticlePreviewContextValue | null {
  return useContext(EditorialArticlePreviewContext)
}
