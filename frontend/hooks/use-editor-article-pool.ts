'use client'

import { useCallback, useRef, useState } from 'react'
import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import {
  EDITOR_FETCH_PAGE_SIZE,
  EDITOR_POOL_PAGE_SIZE,
  fetchAllPaginatedArticles,
  mergeArticlePages,
  type IEditorSearchFilters,
  type IPaginatedArticles,
} from '@/lib/helpers/editor-curation'
import { toRegionCode } from '@/lib/region-code'
import type { IEditorArticlePool, IEditorStoryRow } from '@/interfaces/editor-article'

/**
 * Fetch a single bounded page of the article pool.
 *
 * @param page One-based page number to fetch.
 * @returns The paginated article payload for the requested page.
 * @throws ApiError When the request fails.
 */
export function fetchArticlesPage(page: number): Promise<IPaginatedArticles> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(EDITOR_POOL_PAGE_SIZE),
  })
  return apiFetch<IPaginatedArticles>(`${apiConfig.news}/articles?${params.toString()}`)
}

/**
 * Build the query string for one page of a multi-field article search.
 *
 * A non-empty news id is forwarded as an exact `article_id` override and the
 * remaining filters are dropped, mirroring the backend's precedence rules.
 *
 * @param page One-based page number to fetch.
 * @param filters Active filter-bar values.
 * @returns URL-encoded query string for the `/search` endpoint.
 */
export function buildSearchPageParams(page: number, filters: IEditorSearchFilters): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(EDITOR_FETCH_PAGE_SIZE),
  })
  const newsId = filters.newsId.trim()
  if (newsId) {
    params.set('article_id', newsId)
    return params.toString()
  }
  appendSearchFilterParams(params, filters)
  return params.toString()
}

/**
 * Append the non-id search filters to a params object when they are set.
 *
 * @param params Target query params (mutated in place).
 * @param filters Active filter-bar values.
 */
export function appendSearchFilterParams(
  params: URLSearchParams,
  filters: IEditorSearchFilters,
): void {
  const title = filters.title.trim()
  const categoryId = filters.categoryId.trim()
  const createdFrom = filters.createdFrom.trim()
  const createdTo = filters.createdTo.trim()
  const marketCode = filters.marketCode.trim().toLowerCase()
  const townId = filters.townId.trim().toLowerCase()
  const countyId = filters.countyId.trim().toLowerCase()
  if (title) {
    params.set('q', title)
  }
  if (categoryId) {
    params.set('category_id', categoryId)
  }
  if (createdFrom) {
    params.set('created_from', createdFrom)
  }
  if (createdTo) {
    params.set('created_to', createdTo)
  }
  if (marketCode) {
    params.set('market', marketCode)
    if (townId) {
      params.set('town', townId)
    }
    params.set('region_code', toRegionCode(marketCode, townId || null, countyId || null))
  }
}

/**
 * Load and search the editor's article pool from the news REST API.
 *
 * The pool is loaded one bounded page at a time so memory stays flat
 * regardless of archive size; callers pull additional pages on demand.
 *
 * @returns The loaded article rows plus load, paginate, search, and patch actions.
 */
export function useEditorArticlePool(): IEditorArticlePool {
  const [articles, setArticles] = useState<IEditorStoryRow[]>([])
  const [hasMoreArticles, setHasMoreArticles] = useState(false)
  const [loadingMoreArticles, setLoadingMoreArticles] = useState(false)
  const nextPageRef = useRef(2)
  const loadingMoreRef = useRef(false)

  const loadArticles = useCallback(async () => {
    const data = await fetchArticlesPage(1)
    setArticles(data.items)
    setHasMoreArticles(data.has_more)
    nextPageRef.current = 2
  }, [])

  const loadMoreArticles = useCallback(async () => {
    if (loadingMoreRef.current) {
      return
    }
    loadingMoreRef.current = true
    setLoadingMoreArticles(true)
    try {
      const page = nextPageRef.current
      const data = await fetchArticlesPage(page)
      setArticles((current) => mergeArticlePages(current, data.items))
      setHasMoreArticles(data.has_more)
      nextPageRef.current = page + 1
    } finally {
      loadingMoreRef.current = false
      setLoadingMoreArticles(false)
    }
  }, [])

  const searchArticles = useCallback(
    async (filters: IEditorSearchFilters): Promise<IEditorStoryRow[]> => {
      return fetchAllPaginatedArticles(
        (page) => `${apiConfig.news}/search?${buildSearchPageParams(page, filters)}`,
        (url) => apiFetch(url),
      )
    },
    [],
  )

  const updateArticleRow = useCallback(
    (articleId: string, patch: Partial<IEditorStoryRow>) => {
      setArticles((current) =>
        current.map((row) => (row.id === articleId ? { ...row, ...patch } : row)),
      )
    },
    [],
  )

  return {
    articles,
    hasMoreArticles,
    loadingMoreArticles,
    loadArticles,
    loadMoreArticles,
    searchArticles,
    updateArticleRow,
  }
}
