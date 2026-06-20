'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { IEditorStoryRow } from '@/components/features/editor-story-pool'
import { useEditorScope } from '@/context/editor-scope-context'
import { apiConfig } from '@/lib/api/config'
import type { IEditorScope } from '@/lib/editor/editor-scope'
import {
  getArticlePlacements,
  getHomepageLayout,
  getLayoutSlots,
  type IArticlePlacementOut,
  ISlotOut,
  patchSlotDraftPinnedIds,
  publishHomepagePlacements,
} from '@/lib/api/layout-client'
import { getMediaById, IMediaOut } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'
import { buildArticlePlacementMap } from '@/lib/helpers/article-placements'
import {
  EDITOR_FETCH_PAGE_SIZE,
  REPORTER_UPLOAD_STATUS,
  fetchAllPaginatedArticles,
} from '@/lib/helpers/editor-curation'
import { editorArticleRowToPreview } from '@/lib/helpers/editor-article-preview'
import {
  buildPlacementMutation,
  buildRemovePlacementMutation,
  buildReorderPlacementMutation,
  type IPlacementMutationResult,
  type PlacementMoveDirectionType,
} from '@/lib/helpers/editor-placement'
import {
  buildPlacementTargets,
  resolveSlotLabel,
  type IPlacementTarget,
} from '@/lib/helpers/editor-placement-targets'
import { layoutHasUnpublishedPlacementChanges } from '@/lib/helpers/slot-editor-pinned-ids'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import type { IArticle } from '@/interfaces/article'

export interface IArticleDetail {
  id: string
  title: string
  status: string
  media_ids: string[]
  max_image_count: number
}

export interface ILoadedMedia {
  id: string
  url: string
}

interface IEditorStatus {
  error: string | null
  message: string | null
  loading: boolean
  saving: boolean
  setError: Dispatch<SetStateAction<string | null>>
  setMessage: Dispatch<SetStateAction<string | null>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setSaving: Dispatch<SetStateAction<boolean>>
}

/**
 * Hold the shared error/message/loading/saving banners for the editor page.
 *
 * @returns Status flags and their setters.
 */
function useEditorStatus(): IEditorStatus {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  return { error, message, loading, saving, setError, setMessage, setLoading, setSaving }
}

interface IEditorArticlePool {
  articles: IEditorStoryRow[]
  loadArticles: () => Promise<void>
  searchArticles: (query: string) => Promise<IEditorStoryRow[]>
}

/**
 * Load and search the editor's article pool from the news REST API.
 *
 * @returns The loaded article rows plus load and search actions.
 */
function useEditorArticlePool(): IEditorArticlePool {
  const [articles, setArticles] = useState<IEditorStoryRow[]>([])

  const loadArticles = useCallback(async () => {
    const items = await fetchAllPaginatedArticles(
      (page) => `${apiConfig.news}/articles?${buildPageParams(page)}`,
      (url) => apiFetch(url),
    )
    setArticles(items)
  }, [])

  const searchArticles = useCallback(async (query: string): Promise<IEditorStoryRow[]> => {
    return fetchAllPaginatedArticles(
      (page) => `${apiConfig.news}/search?${buildPageParams(page, query)}`,
      (url) => apiFetch(url),
    )
  }, [])

  return { articles, loadArticles, searchArticles }
}

function buildPageParams(page: number, query?: string): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(EDITOR_FETCH_PAGE_SIZE),
  })
  if (query !== undefined) {
    params.set('q', query)
  }
  return params.toString()
}

interface IArticleDetailEditor {
  selectedId: string | null
  articleIdInput: string
  setArticleIdInput: Dispatch<SetStateAction<string>>
  detail: IArticleDetail | null
  setDetail: Dispatch<SetStateAction<IArticleDetail | null>>
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  maxImageCount: number
  setMaxImageCount: Dispatch<SetStateAction<number>>
  loadArticleDetail: (articleId: string) => Promise<void>
  loadArticleByIdInput: () => void
  saveArticleChanges: () => Promise<void>
  publishSelected: () => Promise<void>
  publishArticleById: (articleId: string) => Promise<void>
}

/**
 * Manage the selected article's media/publish editing workflow.
 *
 * @param status Shared status banners.
 * @param reloadArticles Refreshes the article pool after a write.
 * @returns Detail editing state and actions.
 */
function useArticleDetailEditor(
  status: IEditorStatus,
  scope: IEditorScope,
  reloadArticles: () => Promise<void>,
): IArticleDetailEditor {
  const { setError, setMessage, setSaving } = status
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [articleIdInput, setArticleIdInput] = useState('')
  const [detail, setDetail] = useState<IArticleDetail | null>(null)
  const [mediaItems, setMediaItems] = useState<ILoadedMedia[]>([])
  const [maxImageCount, setMaxImageCount] = useState(5)

  const loadArticleDetail = useCallback(
    async (articleId: string) => {
      setError(null)
      setMessage(null)
      setSelectedId(articleId)
      setArticleIdInput(articleId)
      try {
        const article = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
        setDetail(article)
        setMaxImageCount(article.max_image_count)
        setMediaItems(await loadArticleMedia(article.media_ids))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load article detail')
      }
    },
    [setError, setMessage],
  )

  const loadArticleByIdInput = useCallback(() => {
    const trimmedId = articleIdInput.trim()
    if (!trimmedId) {
      setError('Enter an article id to load.')
      return
    }
    void loadArticleDetail(trimmedId)
  }, [articleIdInput, loadArticleDetail, setError])

  const saveArticleChanges = useCallback(async () => {
    if (!detail) {
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await apiFetch(`${apiConfig.news}/articles/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          media_ids: mediaItems.map((item) => item.id),
          thumbnail_url: mediaItems[0]?.url ?? null,
          max_image_count: maxImageCount,
        }),
      })
      setMessage('Article media settings saved.')
      await reloadArticles()
      notifyEditorialPreviewStale(scope)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article')
    } finally {
      setSaving(false)
    }
  }, [detail, mediaItems, maxImageCount, reloadArticles, scope, setError, setMessage, setSaving])

  const publishSelected = useCallback(async () => {
    if (!detail) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`${apiConfig.news}/articles/${detail.id}/publish`, { method: 'POST' })
      setMessage('Article published.')
      await reloadArticles()
      setDetail({ ...detail, status: 'published' })
      notifyEditorialPreviewStale(scope)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setSaving(false)
    }
  }, [detail, reloadArticles, scope, setError, setMessage, setSaving])

  const publishArticleById = useCallback(
    async (articleId: string) => {
      setSaving(true)
      setError(null)
      try {
        await apiFetch(`${apiConfig.news}/articles/${articleId}/publish`, { method: 'POST' })
        setMessage('Story placed and published. Publish homepage to push it live.')
        await reloadArticles()
        // Keep the open detail in sync when it is the story we just published.
        setDetail((current) =>
          current && current.id === articleId ? { ...current, status: 'published' } : current,
        )
        notifyEditorialPreviewStale(scope)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to publish placed story')
      } finally {
        setSaving(false)
      }
    },
    [reloadArticles, scope, setDetail, setError, setMessage, setSaving],
  )

  return {
    selectedId,
    articleIdInput,
    setArticleIdInput,
    detail,
    setDetail,
    mediaItems,
    setMediaItems,
    maxImageCount,
    setMaxImageCount,
    loadArticleDetail,
    loadArticleByIdInput,
    saveArticleChanges,
    publishSelected,
    publishArticleById,
  }
}

async function loadArticleMedia(mediaIds: string[]): Promise<ILoadedMedia[]> {
  return Promise.all(
    mediaIds.map(async (mediaId) => {
      const asset: IMediaOut = await getMediaById(mediaId)
      return { id: asset.id, url: asset.url }
    }),
  )
}

/**
 * Build a lookup of article preview models keyed by id, including the open detail.
 *
 * @param articles Loaded article pool rows.
 * @param detail Currently open article detail, if any.
 * @param mediaItems Media attached to the open detail.
 * @returns Map of article id to preview model.
 */
function buildArticleById(
  articles: IEditorStoryRow[],
  detail: IArticleDetail | null,
  mediaItems: ILoadedMedia[],
): Map<string, IArticle> {
  const map = new Map<string, IArticle>()
  for (const article of articles) {
    map.set(article.id, editorArticleRowToPreview(article))
  }
  if (detail) {
    map.set(detail.id, mergeDetailPreview(map.get(detail.id), detail, mediaItems))
  }
  return map
}

function mergeDetailPreview(
  existing: IArticle | undefined,
  detail: IArticleDetail,
  mediaItems: ILoadedMedia[],
): IArticle {
  if (existing) {
    return { ...existing, status: detail.status as IArticle['status'] }
  }
  return {
    id: detail.id,
    title: detail.title,
    slug: '',
    summary: null,
    status: detail.status as IArticle['status'],
    authorName: '',
    thumbnailUrl: mediaItems[0]?.url ?? null,
    videoUrl: null,
    createdAt: '',
    publishedAt: null,
  }
}

interface IHomepagePlacementEditor {
  homepageSlots: ISlotOut[]
  articlePlacements: Record<string, IArticlePlacementOut[]>
  placementMap: ReturnType<typeof buildArticlePlacementMap>
  placementTargets: IPlacementTarget[]
  hasUnpublishedPlacements: boolean
  loadHomepageSlots: () => Promise<void>
  loadArticlePlacements: () => Promise<void>
  applyDropPlacement: (articleId: string, target: IPlacementTarget) => Promise<boolean>
  applyRemovePlacement: (target: IPlacementTarget) => Promise<void>
  applyMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => Promise<void>
  publishHomepageChanges: () => Promise<void>
}

/**
 * Manage homepage slot placements, staged moves, and publishing.
 *
 * @param status Shared status banners.
 * @param articleTitleById Lookup of article titles for staged-move messages.
 * @returns Homepage placement state and actions.
 */
function useHomepagePlacementEditor(
  status: IEditorStatus,
  scope: IEditorScope,
  articleTitleById: Map<string, string>,
): IHomepagePlacementEditor {
  const { setError, setMessage, setSaving } = status
  const [homepageSlots, setHomepageSlots] = useState<ISlotOut[]>([])
  const homepageSlotsRef = useRef(homepageSlots)
  const [articlePlacements, setArticlePlacements] = useState<Record<string, IArticlePlacementOut[]>>({})

  useEffect(() => {
    homepageSlotsRef.current = homepageSlots
  }, [homepageSlots])

  const loadHomepageSlots = useCallback(async () => {
    const layout = await getHomepageLayout(scope.marketCode, scope.pageName)
    if (!layout.id) {
      setHomepageSlots([])
      return
    }
    setHomepageSlots(await getLayoutSlots(layout.id))
  }, [scope.marketCode, scope.pageName])

  const loadArticlePlacements = useCallback(async () => {
    const data = await getArticlePlacements(scope.marketCode)
    setArticlePlacements(data.placements)
  }, [scope.marketCode])

  const placementMap = useMemo(
    () => buildArticlePlacementMap(articlePlacements),
    [articlePlacements],
  )
  const placementTargets = useMemo(() => buildPlacementTargets(homepageSlots), [homepageSlots])
  const hasUnpublishedPlacements = useMemo(
    () => layoutHasUnpublishedPlacementChanges(homepageSlots),
    [homepageSlots],
  )

  const publishHomepageChanges = useCallback(async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await publishHomepagePlacements(scope)
      setMessage(formatPublishResult(result.published_slot_count))
      await Promise.all([loadHomepageSlots(), loadArticlePlacements()])
      notifyEditorialPreviewStale(scope)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish homepage placements')
    } finally {
      setSaving(false)
    }
  }, [loadHomepageSlots, loadArticlePlacements, scope, setError, setMessage, setSaving])

  /**
   * Commit a staged placement mutation with optimistic update and rollback.
   *
   * @param mutation Slot patch set to apply.
   * @param buildSuccessMessage Builds the banner text from the pre-mutation slots.
   * @returns Resolves once the mutation is committed or rolled back.
   */
  const runPlacementMutation = useCallback(
    async (
      mutation: PlacementMutation,
      buildSuccessMessage: (previousSlots: ISlotOut[]) => string,
    ): Promise<boolean> => {
      setSaving(true)
      setError(null)
      setMessage(null)
      const previousSlots = homepageSlotsRef.current
      try {
        const mergedSlots = await commitPlacementMutation(mutation, previousSlots, (slots) => {
          setHomepageSlots(slots)
          homepageSlotsRef.current = slots
        })
        setHomepageSlots(mergedSlots)
        homepageSlotsRef.current = mergedSlots
        await Promise.all([loadArticlePlacements(), loadHomepageSlots()])
        setMessage(buildSuccessMessage(previousSlots))
        notifyEditorialPreviewStale(scope)
        return true
      } catch (err) {
        setHomepageSlots(previousSlots)
        homepageSlotsRef.current = previousSlots
        setError(err instanceof Error ? err.message : 'Homepage placement failed')
        return false
      } finally {
        setSaving(false)
      }
    },
    [loadArticlePlacements, loadHomepageSlots, scope, setError, setMessage, setSaving],
  )

  const applyDropPlacement = useCallback(
    async (articleId: string, target: IPlacementTarget): Promise<boolean> => {
      const mutation = buildPlacementMutation(
        homepageSlotsRef.current,
        articleId,
        target.slotId,
        target.index,
        target.articleId,
      )
      return runPlacementMutation(mutation, (previousSlots) =>
        formatPlacementMessage(mutation, previousSlots, articleId, articleTitleById, target),
      )
    },
    [articleTitleById, runPlacementMutation],
  )

  const applyRemovePlacement = useCallback(
    async (target: IPlacementTarget) => {
      const mutation = buildRemovePlacementMutation(
        homepageSlotsRef.current,
        target.slotId,
        target.index,
      )
      await runPlacementMutation(mutation, () => formatRemoveMessage(target, articleTitleById))
    },
    [articleTitleById, runPlacementMutation],
  )

  const applyMovePlacement = useCallback(
    async (target: IPlacementTarget, direction: PlacementMoveDirectionType) => {
      const mutation = buildReorderPlacementMutation(
        homepageSlotsRef.current,
        target.slotId,
        target.index,
        direction,
      )
      await runPlacementMutation(mutation, () => formatMoveMessage(target, direction, articleTitleById))
    },
    [articleTitleById, runPlacementMutation],
  )

  return {
    homepageSlots,
    articlePlacements,
    placementMap,
    placementTargets,
    hasUnpublishedPlacements,
    loadHomepageSlots,
    loadArticlePlacements,
    applyDropPlacement,
    applyRemovePlacement,
    applyMovePlacement,
    publishHomepageChanges,
  }
}

function formatPublishResult(publishedSlotCount: number): string {
  if (publishedSlotCount === 0) {
    return 'No staged homepage placement changes to publish.'
  }
  return `Published homepage placement changes across ${publishedSlotCount} slot(s).`
}

type PlacementMutation = IPlacementMutationResult

async function commitPlacementMutation(
  mutation: PlacementMutation,
  previousSlots: ISlotOut[],
  onOptimistic: (slots: ISlotOut[]) => void,
): Promise<ISlotOut[]> {
  const optimisticById = new Map(
    mutation.updates.map((update) => [update.slotId, update.draftPinnedIds]),
  )
  const optimisticSlots = previousSlots.map((slot) =>
    optimisticById.has(slot.id)
      ? { ...slot, draft_pinned_ids: optimisticById.get(slot.id) ?? [] }
      : slot,
  )
  onOptimistic(optimisticSlots)
  const updatedSlots = await Promise.all(
    mutation.updates.map(async (update) =>
      patchSlotDraftPinnedIds(update.slotId, update.draftPinnedIds),
    ),
  )
  const updatedById = new Map(updatedSlots.map((slot) => [slot.id, slot]))
  return optimisticSlots.map((slot) => updatedById.get(slot.id) ?? slot)
}

function formatPlacementMessage(
  mutation: PlacementMutation,
  previousSlots: ISlotOut[],
  articleId: string,
  articleTitleById: Map<string, string>,
  target: IPlacementTarget,
): string {
  const articleTitle = articleTitleById.get(articleId) ?? articleId
  const destinationLabel = `${target.slotLabel} #${target.index + 1}`
  if (!mutation.fromSlotId) {
    return `Staged "${articleTitle}" in ${destinationLabel}. Publish homepage to go live.`
  }
  const fromSlot = previousSlots.find((slot) => slot.id === mutation.fromSlotId)
  const fromLabel = fromSlot ? resolveSlotLabel(fromSlot) : 'Homepage'
  const fromIndex = (mutation.fromIndex ?? 0) + 1
  return `Staged move of "${articleTitle}" from ${fromLabel} #${fromIndex} to ${destinationLabel}. Publish homepage to go live.`
}

function formatRemoveMessage(
  target: IPlacementTarget,
  articleTitleById: Map<string, string>,
): string {
  const articleTitle = target.articleId ? articleTitleById.get(target.articleId) ?? target.articleId : 'Story'
  const location = `${target.slotLabel} #${target.index + 1}`
  return `Removed "${articleTitle}" from ${location}. Publish homepage to go live.`
}

function formatMoveMessage(
  target: IPlacementTarget,
  direction: PlacementMoveDirectionType,
  articleTitleById: Map<string, string>,
): string {
  const articleTitle = target.articleId ? articleTitleById.get(target.articleId) ?? target.articleId : 'Story'
  return `Moved "${articleTitle}" ${direction} in ${target.slotLabel}. Publish homepage to go live.`
}

export interface IEditorCuration
  extends Omit<IArticleDetailEditor, 'setDetail'>,
    Pick<IEditorArticlePool, 'articles' | 'searchArticles'>,
    Omit<IHomepagePlacementEditor, 'articlePlacements' | 'loadHomepageSlots' | 'loadArticlePlacements'> {
  loading: boolean
  error: string | null
  message: string | null
  saving: boolean
  articleById: Map<string, IArticle>
}

/**
 * Orchestrate the editor curation page: article pool, detail editing, and homepage placement.
 *
 * @returns All state and actions consumed by the editor page UI.
 */
export function useEditorCuration(): IEditorCuration {
  const scope = useEditorScope()
  const status = useEditorStatus()
  const pool = useEditorArticlePool()
  const detailEditor = useArticleDetailEditor(status, scope, pool.loadArticles)

  const articleById = useMemo(
    () => buildArticleById(pool.articles, detailEditor.detail, detailEditor.mediaItems),
    [pool.articles, detailEditor.detail, detailEditor.mediaItems],
  )
  const articleTitleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const [articleId, article] of articleById) {
      map.set(articleId, article.title)
    }
    return map
  }, [articleById])

  const placement = useHomepagePlacementEditor(status, scope, articleTitleById)

  const applyDropPlacement = useCallback(
    async (articleId: string, target: IPlacementTarget): Promise<boolean> => {
      const placed = await placement.applyDropPlacement(articleId, target)
      // A freshly placed reporter draft is auto-published so it can reach the
      // live page once the homepage layout is published.
      if (placed && articleById.get(articleId)?.status === REPORTER_UPLOAD_STATUS) {
        await detailEditor.publishArticleById(articleId)
      }
      return placed
    },
    [placement.applyDropPlacement, articleById, detailEditor.publishArticleById],
  )

  const { setLoading, setError } = status
  useEffect(() => {
    setLoading(true)
    void Promise.all([
      pool.loadArticles(),
      placement.loadHomepageSlots(),
      placement.loadArticlePlacements(),
    ])
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load editor data')
      })
      .finally(() => setLoading(false))
  }, [pool.loadArticles, placement.loadHomepageSlots, placement.loadArticlePlacements, setLoading, setError])

  return {
    loading: status.loading,
    error: status.error,
    message: status.message,
    saving: status.saving,
    articles: pool.articles,
    searchArticles: pool.searchArticles,
    selectedId: detailEditor.selectedId,
    articleIdInput: detailEditor.articleIdInput,
    setArticleIdInput: detailEditor.setArticleIdInput,
    detail: detailEditor.detail,
    mediaItems: detailEditor.mediaItems,
    setMediaItems: detailEditor.setMediaItems,
    maxImageCount: detailEditor.maxImageCount,
    setMaxImageCount: detailEditor.setMaxImageCount,
    loadArticleDetail: detailEditor.loadArticleDetail,
    loadArticleByIdInput: detailEditor.loadArticleByIdInput,
    saveArticleChanges: detailEditor.saveArticleChanges,
    publishSelected: detailEditor.publishSelected,
    publishArticleById: detailEditor.publishArticleById,
    homepageSlots: placement.homepageSlots,
    placementMap: placement.placementMap,
    placementTargets: placement.placementTargets,
    hasUnpublishedPlacements: placement.hasUnpublishedPlacements,
    applyDropPlacement,
    applyRemovePlacement: placement.applyRemovePlacement,
    applyMovePlacement: placement.applyMovePlacement,
    publishHomepageChanges: placement.publishHomepageChanges,
    articleById,
  }
}
