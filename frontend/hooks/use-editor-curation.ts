'use client'

import { useTranslations } from 'next-intl'
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
import { getCategories, type ICategoryOut } from '@/lib/api/category-client'
import { getMediaByIds } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'
import { MIN_CATEGORY_COUNT } from '@/lib/helpers/category-selection'
import { buildArticlePlacementMap } from '@/lib/helpers/article-placements'
import {
  EDITOR_FETCH_PAGE_SIZE,
  EDITOR_POOL_PAGE_SIZE,
  REPORTER_UPLOAD_STATUS,
  fetchAllPaginatedArticles,
  mergeArticlePages,
  type IPaginatedArticles,
} from '@/lib/helpers/editor-curation'
import { editorArticleRowToPreview } from '@/lib/helpers/editor-article-preview'
import {
  appendCategoryCascadeUpdates,
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
import { isHeroOrTopStoriesPositionKey } from '@/lib/helpers/feed-layout'
import { layoutHasUnpublishedPlacementChanges } from '@/lib/helpers/slot-editor-pinned-ids'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import type { IArticle } from '@/interfaces/article'

/**
 * Minimal translator signature for the `admin` namespace.
 *
 * Mirrors the `useTranslations('admin')` call surface this hook relies on so
 * localized banner/error copy can be built in module-level pure helpers.
 */
type AdminTranslatorType = (key: string, values?: Record<string, string | number>) => string

export interface IArticleDetail {
  id: string
  title: string
  status: string
  media_ids: string[]
  max_image_count: number
  category_ids: string[]
  story_id: string | null
  international_potential: number | null
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
  hasMoreArticles: boolean
  loadingMoreArticles: boolean
  loadArticles: () => Promise<void>
  loadMoreArticles: () => Promise<void>
  searchArticles: (query: string) => Promise<IEditorStoryRow[]>
  updateArticleRow: (articleId: string, patch: Partial<IEditorStoryRow>) => void
}

/**
 * Load and search the editor's article pool from the news REST API.
 *
 * The pool is loaded one bounded page at a time so memory stays flat
 * regardless of archive size; callers pull additional pages on demand.
 *
 * @returns The loaded article rows plus load, paginate, search, and patch actions.
 */
function useEditorArticlePool(): IEditorArticlePool {
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

  const searchArticles = useCallback(async (query: string): Promise<IEditorStoryRow[]> => {
    return fetchAllPaginatedArticles(
      (page) => `${apiConfig.news}/search?${buildSearchPageParams(page, query)}`,
      (url) => apiFetch(url),
    )
  }, [])

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

/**
 * Fetch a single bounded page of the article pool.
 *
 * @param page One-based page number to fetch.
 * @returns The paginated article payload for the requested page.
 * @throws ApiError When the request fails.
 */
function fetchArticlesPage(page: number): Promise<IPaginatedArticles> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(EDITOR_POOL_PAGE_SIZE),
  })
  return apiFetch<IPaginatedArticles>(`${apiConfig.news}/articles?${params.toString()}`)
}

function buildSearchPageParams(page: number, query: string): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(EDITOR_FETCH_PAGE_SIZE),
    q: query,
  })
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
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  storyId: string
  setStoryId: Dispatch<SetStateAction<string>>
  isDirty: boolean
  markDirty: () => void
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
 * @param scope Active editor market/page scope.
 * @param updateArticleRow Patches a single pool row after a write.
 * @returns Detail editing state and actions.
 */
function useArticleDetailEditor(
  status: IEditorStatus,
  scope: IEditorScope,
  updateArticleRow: (articleId: string, patch: Partial<IEditorStoryRow>) => void,
): IArticleDetailEditor {
  const t = useTranslations('admin')
  const { setError, setMessage, setSaving } = status
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [articleIdInput, setArticleIdInput] = useState('')
  const [detail, setDetail] = useState<IArticleDetail | null>(null)
  const [mediaItems, setMediaItems] = useState<ILoadedMedia[]>([])
  const [maxImageCount, setMaxImageCount] = useState(5)
  const [categories, setCategories] = useState<ICategoryOut[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [internationalPotential, setInternationalPotential] = useState<number | null>(null)
  const [storyId, setStoryId] = useState('')
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
        setSelectedCategoryIds(article.category_ids ?? [])
        setInternationalPotential(article.international_potential ?? null)
        setStoryId(article.story_id ?? '')
        setMediaItems(await loadArticleMedia(article.media_ids))
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

  const saveArticleChanges = useCallback(async () => {
    if (!detail) {
      return
    }
    if (selectedCategoryIds.length < MIN_CATEGORY_COUNT) {
      setError(t('editor.errors.selectCategory'))
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          media_ids: mediaItems.map((item) => item.id),
          thumbnail_url: mediaItems[0]?.url ?? null,
          max_image_count: maxImageCount,
          category_ids: selectedCategoryIds,
          story_id: storyId.trim() || null,
          international_potential: internationalPotential,
        }),
      })
      setDetail(updated)
      setIsDirty(false)
      setMessage(t('editor.status.settingsSaved'))
      updateArticleRow(updated.id, {
        title: updated.title,
        status: updated.status,
        thumbnail_url: mediaItems[0]?.url ?? null,
      })
      notifyEditorialPreviewStale(scope)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.errors.saveArticle'))
    } finally {
      setSaving(false)
    }
  }, [
    detail,
    mediaItems,
    maxImageCount,
    selectedCategoryIds,
    storyId,
    internationalPotential,
    updateArticleRow,
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
    isDirty,
    markDirty,
    loadArticleDetail,
    loadArticleByIdInput,
    saveArticleChanges,
    publishSelected,
    publishArticleById,
  }
}

async function loadArticleMedia(mediaIds: string[]): Promise<ILoadedMedia[]> {
  const assets = await getMediaByIds(mediaIds)
  return assets.map((asset) => ({ id: asset.id, url: asset.url }))
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
 * @param scope Active editor market/page scope.
 * @param articleTitleById Lookup of article titles for staged-move messages.
 * @param categories Available categories, used to cascade hero/top-stories pins.
 * @returns Homepage placement state and actions.
 */
function useHomepagePlacementEditor(
  status: IEditorStatus,
  scope: IEditorScope,
  articleTitleById: Map<string, string>,
  categories: ICategoryOut[],
): IHomepagePlacementEditor {
  const t = useTranslations('admin')
  const { setError, setMessage, setSaving } = status
  const [homepageSlots, setHomepageSlots] = useState<ISlotOut[]>([])
  const homepageSlotsRef = useRef(homepageSlots)
  const [articlePlacements, setArticlePlacements] = useState<Record<string, IArticlePlacementOut[]>>({})

  const categorySlugById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      map.set(category.id, category.slug)
    }
    return map
  }, [categories])

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
      setMessage(formatPublishResult(t, result.published_slot_count))
      await Promise.all([loadHomepageSlots(), loadArticlePlacements()])
      notifyEditorialPreviewStale(scope)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.errors.publishPlacements'))
    } finally {
      setSaving(false)
    }
  }, [loadHomepageSlots, loadArticlePlacements, scope, setError, setMessage, setSaving, t])

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
        setError(err instanceof Error ? err.message : t('editor.errors.placementFailed'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [loadArticlePlacements, loadHomepageSlots, scope, setError, setMessage, setSaving, t],
  )

  /**
   * Resolve the category sections a hero/top-stories drop should cascade into.
   *
   * @param articleId Story being placed.
   * @param target Drop target slot/index metadata.
   * @returns Category slot ids to also pin the story into (empty when N/A).
   */
  const resolveDropCascadeSlotIds = useCallback(
    async (articleId: string, target: IPlacementTarget): Promise<string[]> => {
      if (!isHeroOrTopStoriesPositionKey(target.positionKey)) {
        return []
      }
      const categoryIds = await fetchArticleCategoryIds(articleId)
      return resolveCategoryCascadeSlotIds({
        slots: homepageSlotsRef.current,
        categoryIds,
        categorySlugById,
        targetSlotId: target.slotId,
      })
    },
    [categorySlugById],
  )

  const applyDropPlacement = useCallback(
    async (articleId: string, target: IPlacementTarget): Promise<boolean> => {
      const cascadeSlotIds = await resolveDropCascadeSlotIds(articleId, target)
      const baseMutation = buildPlacementMutation(
        homepageSlotsRef.current,
        articleId,
        target.slotId,
        target.index,
        target.articleId,
      )
      const mutation = cascadeSlotIds.length
        ? appendCategoryCascadeUpdates(baseMutation, homepageSlotsRef.current, articleId, cascadeSlotIds)
        : baseMutation
      return runPlacementMutation(mutation, (previousSlots) =>
        formatPlacementMessage({
          t,
          mutation,
          previousSlots,
          articleId,
          articleTitleById,
          target,
          cascadeCount: cascadeSlotIds.length,
        }),
      )
    },
    [articleTitleById, resolveDropCascadeSlotIds, runPlacementMutation, t],
  )

  const applyRemovePlacement = useCallback(
    async (target: IPlacementTarget) => {
      const mutation = buildRemovePlacementMutation(
        homepageSlotsRef.current,
        target.slotId,
        target.index,
      )
      await runPlacementMutation(mutation, () => formatRemoveMessage(t, target, articleTitleById))
    },
    [articleTitleById, runPlacementMutation, t],
  )

  const applyMovePlacement = useCallback(
    async (target: IPlacementTarget, direction: PlacementMoveDirectionType) => {
      const mutation = buildReorderPlacementMutation(
        homepageSlotsRef.current,
        target.slotId,
        target.index,
        direction,
      )
      await runPlacementMutation(mutation, () =>
        formatMoveMessage(t, target, direction, articleTitleById),
      )
    },
    [articleTitleById, runPlacementMutation, t],
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

/**
 * Build the localized banner reporting how many slots were published.
 *
 * @param t Admin-namespace translator.
 * @param publishedSlotCount Number of slots whose draft pins went live.
 * @returns Localized publish-result banner text.
 */
function formatPublishResult(t: AdminTranslatorType, publishedSlotCount: number): string {
  if (publishedSlotCount === 0) {
    return t('editor.publishResult.none')
  }
  return t('editor.publishResult.count', { count: publishedSlotCount })
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

interface ICategoryCascadeOptions {
  slots: ISlotOut[]
  categoryIds: string[]
  categorySlugById: Map<string, string>
  targetSlotId: string
}

/**
 * Fetch the categories a story belongs to from its detail endpoint.
 *
 * @param articleId Article id to look up.
 * @returns Category ids assigned to the article.
 * @throws ApiError When the detail request fails.
 */
async function fetchArticleCategoryIds(articleId: string): Promise<string[]> {
  const detail = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
  return detail.category_ids ?? []
}

/**
 * Resolve homepage slot ids matching a story's categories for cascade pins.
 *
 * Categories without a homepage section slot are skipped silently, and the
 * drop target slot itself is never included in the cascade.
 *
 * @param options Slots, category ids, slug lookup, and the excluded target slot.
 * @returns Slot ids of category sections to pin the story into.
 */
function resolveCategoryCascadeSlotIds(options: ICategoryCascadeOptions): string[] {
  const { slots, categoryIds, categorySlugById, targetSlotId } = options
  const targetSlugs = new Set(
    categoryIds
      .map((categoryId) => categorySlugById.get(categoryId)?.trim().toLowerCase())
      .filter((slug): slug is string => Boolean(slug)),
  )
  return slots
    .filter(
      (slot) =>
        slot.id !== targetSlotId &&
        slot.content_type === 'articles' &&
        targetSlugs.has(slot.position_key.trim().toLowerCase()),
    )
    .map((slot) => slot.id)
}

interface IPlacementMessageOptions {
  t: AdminTranslatorType
  mutation: PlacementMutation
  previousSlots: ISlotOut[]
  articleId: string
  articleTitleById: Map<string, string>
  target: IPlacementTarget
  cascadeCount: number
}

/**
 * Describe the localized cascade portion of a staged placement banner.
 *
 * @param t Admin-namespace translator.
 * @param cascadeCount Number of category sections the story was pinned into.
 * @returns Banner suffix naming the cascade, or an empty string when none.
 */
function formatCascadeSuffix(t: AdminTranslatorType, cascadeCount: number): string {
  if (cascadeCount <= 0) {
    return ''
  }
  return t('editor.placement.cascadeSuffix', { count: cascadeCount })
}

/**
 * Build the localized staged-change banner for a drag-drop placement.
 *
 * @param options Translator, mutation, prior slots, lookup, target, and cascade count.
 * @returns Localized banner text for the placement.
 */
function formatPlacementMessage(options: IPlacementMessageOptions): string {
  const { t, mutation, previousSlots, articleId, articleTitleById, target, cascadeCount } = options
  const title = articleTitleById.get(articleId) ?? articleId
  const destination = `${target.slotLabel} #${target.index + 1}`
  const cascade = formatCascadeSuffix(t, cascadeCount)
  if (!mutation.fromSlotId) {
    return t('editor.placement.staged', { title, destination, cascade })
  }
  const fromSlot = previousSlots.find((slot) => slot.id === mutation.fromSlotId)
  const fromLabel = fromSlot ? resolveSlotLabel(fromSlot) : t('editor.placement.fallbackSlot')
  const fromIndex = (mutation.fromIndex ?? 0) + 1
  return t('editor.placement.stagedMove', {
    title,
    from: `${fromLabel} #${fromIndex}`,
    destination,
    cascade,
  })
}

/**
 * Build the localized banner for removing a story from a slot.
 *
 * @param t Admin-namespace translator.
 * @param target Slot/index metadata for the removed placement.
 * @param articleTitleById Lookup of article titles by id.
 * @returns Localized removal banner text.
 */
function formatRemoveMessage(
  t: AdminTranslatorType,
  target: IPlacementTarget,
  articleTitleById: Map<string, string>,
): string {
  const title = target.articleId
    ? articleTitleById.get(target.articleId) ?? target.articleId
    : t('editor.placement.fallbackTitle')
  const location = `${target.slotLabel} #${target.index + 1}`
  return t('editor.placement.removed', { title, location })
}

/**
 * Build the localized banner for reordering a story within a slot.
 *
 * @param t Admin-namespace translator.
 * @param target Slot/index metadata for the moved placement.
 * @param direction Reorder direction applied to the placement.
 * @param articleTitleById Lookup of article titles by id.
 * @returns Localized move banner text.
 */
function formatMoveMessage(
  t: AdminTranslatorType,
  target: IPlacementTarget,
  direction: PlacementMoveDirectionType,
  articleTitleById: Map<string, string>,
): string {
  const title = target.articleId
    ? articleTitleById.get(target.articleId) ?? target.articleId
    : t('editor.placement.fallbackTitle')
  return t('editor.placement.moved', {
    title,
    direction: t(`editor.placement.directions.${direction}`),
    slot: target.slotLabel,
  })
}

export interface IEditorCuration
  extends Omit<IArticleDetailEditor, 'setDetail'>,
    Pick<
      IEditorArticlePool,
      'articles' | 'searchArticles' | 'hasMoreArticles' | 'loadingMoreArticles' | 'loadMoreArticles'
    >,
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
  const t = useTranslations('admin')
  const scope = useEditorScope()
  const status = useEditorStatus()
  const pool = useEditorArticlePool()
  const detailEditor = useArticleDetailEditor(status, scope, pool.updateArticleRow)

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

  const placement = useHomepagePlacementEditor(status, scope, articleTitleById, detailEditor.categories)

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
        setError(err instanceof Error ? err.message : t('editor.errors.loadEditorData'))
      })
      .finally(() => setLoading(false))
  }, [pool.loadArticles, placement.loadHomepageSlots, placement.loadArticlePlacements, setLoading, setError, t])

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
    isDirty: detailEditor.isDirty,
    markDirty: detailEditor.markDirty,
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
