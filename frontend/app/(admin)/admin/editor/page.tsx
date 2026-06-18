'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorStoryPool, type IEditorStoryRow } from '@/components/features/editor-story-pool'
import { HomepagePlacementCanvas } from '@/components/features/homepage-placement-canvas'
import { HomepagePreviewPane } from '@/components/features/homepage-preview-pane'
import { apiConfig } from '@/lib/api/config'
import {
  getArticlePlacements,
  getHomepageLayout,
  getHomepagePreviewFeed,
  getLayoutSlots,
  type IArticlePlacementOut,
  ISlotOut,
  patchSlotDraftPinnedIds,
  publishHomepagePlacements,
} from '@/lib/api/layout-client'
import { getMediaById, IMediaOut } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'
import {
  buildArticlePlacementMap,
  formatAllArticlePlacements
} from '@/lib/helpers/article-placements'
import { editorArticleRowToPreview } from '@/lib/helpers/editor-article-preview'
import { buildPlacementMutation } from '@/lib/helpers/editor-placement'
import {
  buildPlacementTargets,
  resolveSlotLabel,
  type IPlacementTarget
} from '@/lib/helpers/editor-placement-targets'
import { layoutHasUnpublishedPlacementChanges } from '@/lib/helpers/slot-editor-pinned-ids'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import type { IArticle } from '@/interfaces/article'
import type { IHomepageFeed } from '@/interfaces/feed'

interface IArticleDetail {
  id: string
  title: string
  status: string
  media_ids: string[]
  max_image_count: number
}

interface IPaginatedArticles {
  items: IEditorStoryRow[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

const EDITOR_FETCH_PAGE_SIZE = 200
const EDITOR_WORKSPACE_HEIGHT_CLASS = 'lg:max-h-[calc(100dvh-14rem)]'
const EDITOR_CANVAS_STICKY_CLASS = 'lg:sticky lg:top-24 lg:self-start'

type EditorPanelModeType = 'placement' | 'preview'

interface ILoadedMedia {
  id: string
  url: string
}

/**
 * Move an array item to a new index.
 *
 * @param items Source list.
 * @param fromIndex Current index.
 * @param toIndex Target index.
 * @returns Reordered list.
 */
function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

/**
 * Fetch every page from a paginated articles endpoint.
 *
 * @param buildUrl Builds the request URL for a page number.
 * @returns Combined article rows.
 */
async function fetchAllPaginatedArticles(
  buildUrl: (page: number) => string,
): Promise<IEditorStoryRow[]> {
  const items: IEditorStoryRow[] = []
  let page = 1

  while (true) {
    const data = await apiFetch<IPaginatedArticles>(buildUrl(page))
    items.push(...data.items)
    if (!data.has_more) {
      break
    }
    page += 1
  }

  return items
}

export default function EditorCurationPage(): JSX.Element {
  const [articles, setArticles] = useState<IEditorStoryRow[]>([])
  const [homepageSlots, setHomepageSlots] = useState<ISlotOut[]>([])
  const homepageSlotsRef = useRef(homepageSlots)
  const [articlePlacements, setArticlePlacements] = useState<Record<string, IArticlePlacementOut[]>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [articleIdInput, setArticleIdInput] = useState('')
  const [detail, setDetail] = useState<IArticleDetail | null>(null)
  const [mediaItems, setMediaItems] = useState<ILoadedMedia[]>([])
  const [maxImageCount, setMaxImageCount] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [panelMode, setPanelMode] = useState<EditorPanelModeType>('placement')
  const [previewFeed, setPreviewFeed] = useState<IHomepageFeed | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const hasUnpublishedPlacements = useMemo(
    () => layoutHasUnpublishedPlacementChanges(homepageSlots),
    [homepageSlots],
  )

  const loadPreviewFeed = useCallback(async () => {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const feed = await getHomepagePreviewFeed()
      setPreviewFeed(feed)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load homepage preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const loadArticles = useCallback(async () => {
    const items = await fetchAllPaginatedArticles((page) => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(EDITOR_FETCH_PAGE_SIZE),
      })
      return `${apiConfig.news}/articles?${params.toString()}`
    })
    setArticles(items)
  }, [])

  const searchArticles = useCallback(async (query: string): Promise<IEditorStoryRow[]> => {
    return fetchAllPaginatedArticles((page) => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(EDITOR_FETCH_PAGE_SIZE),
        q: query,
      })
      return `${apiConfig.news}/search?${params.toString()}`
    })
  }, [])

  const placementMap = useMemo(
    () => buildArticlePlacementMap(articlePlacements),
    [articlePlacements],
  )

  const loadHomepageSlots = useCallback(async () => {
    const layout = await getHomepageLayout()
    if (!layout.id) {
      setHomepageSlots([])
      return
    }
    const slots = await getLayoutSlots(layout.id)
    setHomepageSlots(slots)
  }, [])

  const loadArticlePlacements = useCallback(async () => {
    const data = await getArticlePlacements()
    setArticlePlacements(data.placements)
  }, [])

  useEffect(() => {
    homepageSlotsRef.current = homepageSlots
  }, [homepageSlots])

  useEffect(() => {
    setLoading(true)
    void Promise.all([loadArticles(), loadHomepageSlots(), loadArticlePlacements()])
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load editor data')
      })
      .finally(() => setLoading(false))
  }, [loadArticles, loadHomepageSlots, loadArticlePlacements])

  useEffect(() => {
    if (panelMode !== 'preview') {
      return
    }
    void loadPreviewFeed()
  }, [panelMode, loadPreviewFeed])

  async function loadArticleDetail(articleId: string) {
    setError(null)
    setMessage(null)
    setSelectedId(articleId)
    setArticleIdInput(articleId)
    try {
      const article = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
      setDetail(article)
      setMaxImageCount(article.max_image_count)
      const media = await Promise.all(
        article.media_ids.map(async (mediaId) => {
          const asset: IMediaOut = await getMediaById(mediaId)
          return { id: asset.id, url: asset.url }
        }),
      )
      setMediaItems(media)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article detail')
    }
  }

  function loadArticleByIdInput() {
    const trimmedId = articleIdInput.trim()
    if (!trimmedId) {
      setError('Enter an article id to load.')
      return
    }
    void loadArticleDetail(trimmedId)
  }

  async function saveArticleChanges() {
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
      await loadArticles()
      notifyEditorialPreviewStale()
      if (panelMode === 'preview') {
        await loadPreviewFeed()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article')
    } finally {
      setSaving(false)
    }
  }

  async function publishSelected() {
    if (!detail) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`${apiConfig.news}/articles/${detail.id}/publish`, { method: 'POST' })
      setMessage('Article published.')
      await loadArticles()
      setDetail({ ...detail, status: 'published' })
      notifyEditorialPreviewStale()
      if (panelMode === 'preview') {
        await loadPreviewFeed()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setSaving(false)
    }
  }

  const placementTargets = useMemo(() => buildPlacementTargets(homepageSlots), [homepageSlots])

  const articleById = useMemo(() => {
    const map = new Map<string, IArticle>()
    for (const article of articles) {
      map.set(article.id, editorArticleRowToPreview(article))
    }
    if (detail) {
      const existing = map.get(detail.id)
      map.set(
        detail.id,
        existing
          ? { ...existing, status: detail.status as IArticle['status'] }
          : {
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
            },
      )
    }
    return map
  }, [articles, detail, mediaItems])

  const articleTitleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const [articleId, article] of articleById) {
      map.set(articleId, article.title)
    }
    return map
  }, [articleById])

  async function publishHomepageChanges() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await publishHomepagePlacements()
      if (result.published_slot_count === 0) {
        setMessage('No staged homepage placement changes to publish.')
      } else {
        setMessage(
          `Published homepage placement changes across ${result.published_slot_count} slot(s).`,
        )
      }
      await Promise.all([loadHomepageSlots(), loadArticlePlacements()])
      notifyEditorialPreviewStale()
      if (panelMode === 'preview') {
        await loadPreviewFeed()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish homepage placements')
    } finally {
      setSaving(false)
    }
  }

  async function applyDropPlacement(articleId: string, target: IPlacementTarget) {
    setSaving(true)
    setError(null)
    setMessage(null)
    const previousSlots = homepageSlotsRef.current
    try {
      const mutation = buildPlacementMutation(
        previousSlots,
        articleId,
        target.slotId,
        target.index,
        target.articleId,
      )
      const optimisticById = new Map(
        mutation.updates.map((update) => [update.slotId, update.draftPinnedIds]),
      )
      const optimisticSlots = previousSlots.map((slot) =>
        optimisticById.has(slot.id)
          ? { ...slot, draft_pinned_ids: optimisticById.get(slot.id) ?? [] }
          : slot,
      )
      setHomepageSlots(optimisticSlots)
      homepageSlotsRef.current = optimisticSlots
      const updatedSlots = await Promise.all(
        mutation.updates.map(async (update) =>
          patchSlotDraftPinnedIds(update.slotId, update.draftPinnedIds),
        ),
      )
      const updatedById = new Map(updatedSlots.map((slot) => [slot.id, slot]))
      const mergedSlots = optimisticSlots.map((slot) => updatedById.get(slot.id) ?? slot)
      setHomepageSlots(mergedSlots)
      homepageSlotsRef.current = mergedSlots
      await Promise.all([loadArticlePlacements(), loadHomepageSlots()])

      const articleTitle = articleTitleById.get(articleId) ?? articleId
      const destinationLabel = `${target.slotLabel} #${target.index + 1}`
      if (mutation.fromSlotId) {
        const fromSlot = previousSlots.find((slot) => slot.id === mutation.fromSlotId)
        const fromLabel = fromSlot
          ? resolveSlotLabel(fromSlot)
          : 'Homepage'
        const fromIndex = (mutation.fromIndex ?? 0) + 1
        setMessage(`Staged move of "${articleTitle}" from ${fromLabel} #${fromIndex} to ${destinationLabel}. Publish homepage to go live.`)
      } else {
        setMessage(`Staged "${articleTitle}" in ${destinationLabel}. Publish homepage to go live.`)
      }
      notifyEditorialPreviewStale()
      if (panelMode === 'preview') {
        await loadPreviewFeed()
      }
    } catch (err) {
      setHomepageSlots(previousSlots)
      homepageSlotsRef.current = previousSlots
      setError(err instanceof Error ? err.message : 'Homepage placement failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-2xl font-bold">Editor</h1>
        <Link
          href="/admin/preview"
          className="text-sm font-semibold text-brand hover:underline"
        >
          Preview
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Stage homepage placement changes, preview them, then publish when ready.
      </p>

      {hasUnpublishedPlacements ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            You have unpublished homepage placement changes. The public site still shows the last published layout.
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void publishHomepageChanges()}
            className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
          >
            Publish homepage
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-neutral-600">Loading stories…</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <section className="min-w-0 rounded-lg border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-end gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <label className="min-w-[16rem] flex-1 text-sm font-medium text-neutral-700">
                Load by article id
                <input
                  type="text"
                  value={articleIdInput}
                  onChange={(event) => setArticleIdInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      loadArticleByIdInput()
                    }
                  }}
                  placeholder="e.g. 96aeb8aa-d57e-4521-a393-17b7db4b6827"
                  className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs"
                />
              </label>
              <button
                type="button"
                onClick={loadArticleByIdInput}
                className="rounded border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5"
              >
                Load story
              </button>
            </div>
            <div className="p-4">
              <EditorStoryPool
                articles={articles}
                selectedId={selectedId}
                placementMap={placementMap}
                onSearch={searchArticles}
                onSelect={(articleId) => void loadArticleDetail(articleId)}
              />
              {articles.length === 0 ? (
                <p className="py-8 text-center text-neutral-500">No uploaded stories yet.</p>
              ) : null}
            </div>
          </section>

          <div
            className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${EDITOR_WORKSPACE_HEIGHT_CLASS} ${EDITOR_CANVAS_STICKY_CLASS}`}
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
              <div className="rounded-lg border border-neutral-200 bg-white p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setPanelMode('placement')}
                    className={[
                      'rounded px-3 py-2 text-sm font-medium',
                      panelMode === 'placement'
                        ? 'bg-brand text-white'
                        : 'text-neutral-700 hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    Placement
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelMode('preview')}
                    className={[
                      'rounded px-3 py-2 text-sm font-medium',
                      panelMode === 'preview'
                        ? 'bg-brand text-white'
                        : 'text-neutral-700 hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {panelMode === 'placement' ? (
                <HomepagePlacementCanvas
                  slots={homepageSlots}
                  targets={placementTargets}
                  articleById={articleById}
                  selectedArticleId={selectedId}
                  saving={saving}
                  onDropPlacement={(articleId, target) => void applyDropPlacement(articleId, target)}
                />
              ) : (
                <HomepagePreviewPane
                  feed={previewFeed}
                  loading={previewLoading}
                  error={previewError}
                />
              )}

              <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4">
              {!detail ? (
                <p className="text-sm text-neutral-500">Select a story to curate media and placement.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-lg font-semibold">{detail.title}</h2>
                    <p className="mt-1 font-mono text-xs text-neutral-400">{detail.id}</p>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">{detail.status}</p>
                    <p className="mt-2 text-sm text-neutral-600">
                      Location: {formatAllArticlePlacements(placementMap.get(detail.id) ?? [])}
                    </p>
                  </div>

                  <label className="block text-sm font-medium text-neutral-700">
                    Max image count
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={maxImageCount}
                      onChange={(event) => setMaxImageCount(Number(event.target.value))}
                      className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
                    />
                  </label>

                  <div>
                    <p className="text-sm font-medium text-neutral-700">Attached images</p>
                    <ul className="mt-2 space-y-2">
                      {mediaItems.map((item, index) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 rounded border border-neutral-200 p-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.url} alt="" className="h-12 w-12 rounded object-cover" />
                          <span className="flex-1 text-xs text-neutral-500">#{index + 1}</span>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => setMediaItems((current) => moveItem(current, index, index - 1))}
                            className="text-xs text-neutral-600 hover:text-brand disabled:opacity-40"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            disabled={index === mediaItems.length - 1}
                            onClick={() => setMediaItems((current) => moveItem(current, index, index + 1))}
                            className="text-xs text-neutral-600 hover:text-brand disabled:opacity-40"
                          >
                            Down
                          </button>
                        </li>
                      ))}
                    </ul>
                    {mediaItems.length === 0 ? (
                      <p className="mt-2 text-sm text-neutral-500">No images attached.</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveArticleChanges()}
                      className="rounded border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
                    >
                      Save media settings
                    </button>
                    {detail.status === 'draft' ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void publishSelected()}
                        className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
                      >
                        Publish
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
