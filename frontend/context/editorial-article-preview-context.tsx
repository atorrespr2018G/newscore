'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { IArticle, IArticleDetail } from '@/interfaces/article'
import { fetchAdminArticleForReading } from '@/lib/helpers/admin-article-reading'

interface IEditorialArticlePreviewContextValue {
  selectedArticle: IArticle | null
  articleDetail: IArticleDetail | null
  loading: boolean
  error: string | null
  isOpen: boolean
  openPreview: (article: IArticle) => void
  closePreview: () => void
}

const EditorialArticlePreviewContext = createContext<IEditorialArticlePreviewContextValue | null>(null)

interface IEditorialArticlePreviewProviderProps {
  children: ReactNode
}

/**
 * Provide editorial article read-preview state for Placement and Preview surfaces.
 *
 * @param props Child tree that can open the read overlay via story card clicks.
 * @returns Provider wrapping the admin preview homepage.
 */
export function EditorialArticlePreviewProvider({
  children,
}: IEditorialArticlePreviewProviderProps): JSX.Element {
  const [selectedArticle, setSelectedArticle] = useState<IArticle | null>(null)
  const [articleDetail, setArticleDetail] = useState<IArticleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const closePreview = useCallback((): void => {
    requestIdRef.current += 1
    setSelectedArticle(null)
    setArticleDetail(null)
    setLoading(false)
    setError(null)
  }, [])

  const openPreview = useCallback((article: IArticle): void => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setSelectedArticle(article)
    setArticleDetail(null)
    setLoading(true)
    setError(null)

    void fetchAdminArticleForReading(article.id)
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
  }, [])

  const value: IEditorialArticlePreviewContextValue = {
    selectedArticle,
    articleDetail,
    loading,
    error,
    isOpen: selectedArticle !== null,
    openPreview,
    closePreview,
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
