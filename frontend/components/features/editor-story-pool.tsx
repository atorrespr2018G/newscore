'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
import { EditorArticleDetailPanel } from '@/components/features/editor-article-detail-panel'
import type { ICategoryOut } from '@/lib/api/category-client'
import type { IArticleDetail, ILoadedMedia } from '@/hooks/use-editor-curation'
import { editorArticleRowToPreview } from '@/lib/helpers/editor-article-preview'
import {
  formatAllArticlePlacements,
  formatArticlePlacements,
  type IArticlePlacement,
} from '@/lib/helpers/article-placements'
import { isNewReporterArticle } from '@/lib/helpers/editor-curation'

const EDITOR_SEARCH_DEBOUNCE_MS = 300

export interface IEditorStoryRow {
  id: string
  title: string
  slug: string
  status: string
  author_name: string
  thumbnail_url: string | null
}

type PlacementFilterType = 'all' | 'unplaced' | 'homepage'

/** Which source list of stories the editor is currently viewing. */
type NewsTabType = 'all' | 'new'

/**
 * Decide whether an article passes the active placement quick filter.
 *
 * @param placements Resolved placements for the article.
 * @param filter Active placement filter selection.
 * @returns True when the article should remain visible.
 */
function matchesPlacementFilter(
  placements: IArticlePlacement[],
  filter: PlacementFilterType,
): boolean {
  if (filter === 'unplaced') {
    return placements.length === 0
  }
  if (filter === 'homepage') {
    return placements.some((placement) => placement.pageName === 'homepage')
  }
  return true
}

interface IEditorStoryPoolProps {
  articles: IEditorStoryRow[]
  selectedId: string | null
  placementMap: Map<string, IArticlePlacement[]>
  onSearch: (query: string) => Promise<IEditorStoryRow[]>
  onSelect: (articleId: string) => void
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  storyId: string
  setStoryId: Dispatch<SetStateAction<string>>
  detail: IArticleDetail | null
  maxImageCount: number
  setMaxImageCount: (value: number) => void
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  saving: boolean
  onSave: () => void
  onPublish: () => void
  onDirty: () => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

/**
 * Editor list with quick filters and drag handles.
 *
 * @param props Component props.
 * @returns Curated article pool UI.
 */
export function EditorStoryPool(props: IEditorStoryPoolProps): JSX.Element {
  const {
    articles,
    selectedId,
    placementMap,
    onSearch,
    onSelect,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    internationalPotential,
    setInternationalPotential,
    storyId,
    setStoryId,
    detail,
    maxImageCount,
    setMaxImageCount,
    mediaItems,
    setMediaItems,
    saving,
    onSave,
    onPublish,
    onDirty,
    hasMore,
    loadingMore,
    onLoadMore,
  } = props
  const t = useTranslations('admin')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<IEditorStoryRow[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [placementFilter, setPlacementFilter] = useState<PlacementFilterType>('all')
  const [activeTab, setActiveTab] = useState<NewsTabType>('all')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, EDITOR_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)
    void onSearch(debouncedSearch)
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchResults([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, onSearch])

  const sourceArticles = searchResults ?? articles

  const newCount = useMemo(
    () =>
      articles.filter((article) => isNewReporterArticle(article, placementMap.get(article.id) ?? []))
        .length,
    [articles, placementMap],
  )

  const visibleArticles = useMemo(() => {
    return sourceArticles.filter((article) => {
      const placements = placementMap.get(article.id) ?? []
      // The "New" tab only surfaces freshly uploaded reporter stories; once
      // placed on the canvas they drop out here and reappear in the All tab.
      if (activeTab === 'new') {
        return isNewReporterArticle(article, placements)
      }
      return matchesPlacementFilter(placements, placementFilter)
    })
  }, [activeTab, placementFilter, placementMap, sourceArticles])

  return (
    <div className="flex flex-col">
      <NewsTabBar activeTab={activeTab} newCount={newCount} onTabChange={setActiveTab} />

      <div className="pb-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
          <label className="text-sm font-medium text-neutral-700">
            {t('editor.pool.searchLabel')}
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('editor.pool.searchPlaceholder')}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          {activeTab === 'all' ? (
            <PlacementFilterButtons activeFilter={placementFilter} onFilterChange={setPlacementFilter} />
          ) : null}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleArticles.map((article) => (
          <article
            key={article.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', article.id)
              event.dataTransfer.effectAllowed = 'move'
            }}
            className={[
              'overflow-hidden rounded-lg border bg-white transition-colors',
              selectedId === article.id
                ? 'border-brand ring-1 ring-brand/30'
                : 'border-neutral-200 hover:border-neutral-300',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSelect(article.id)}
              className="w-full cursor-pointer text-left"
            >
              <HomepageStoryThumb article={editorArticleRowToPreview(article)} />
              <div className="space-y-2 border-t border-neutral-100 p-3">
                <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-neutral-900">
                  {article.title}
                </h3>
                <dl className="space-y-1 text-xs text-neutral-600">
                  <div>
                    <dt className="inline font-medium text-neutral-500">
                      {t('editor.pool.row.id')}{' '}
                    </dt>
                    <dd className="inline font-mono text-[11px] text-neutral-700">{article.id}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-500">
                      {t('editor.pool.row.status')}{' '}
                    </dt>
                    <dd className="inline capitalize">{article.status}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-500">
                      {t('editor.pool.row.author')}{' '}
                    </dt>
                    <dd className="inline">{article.author_name}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-500">
                      {t('editor.pool.row.location')}{' '}
                    </dt>
                    <dd
                      className="inline leading-snug"
                      title={formatAllArticlePlacements(placementMap.get(article.id) ?? [])}
                    >
                      {formatArticlePlacements(placementMap.get(article.id) ?? [])}
                    </dd>
                  </div>
                </dl>
              </div>
            </button>
            {selectedId === article.id ? (
              <EditorArticleDetailPanel
                detail={detail}
                categories={categories}
                selectedCategoryIds={selectedCategoryIds}
                setSelectedCategoryIds={setSelectedCategoryIds}
                internationalPotential={internationalPotential}
                setInternationalPotential={setInternationalPotential}
                storyId={storyId}
                setStoryId={setStoryId}
                maxImageCount={maxImageCount}
                onMaxImageCountChange={setMaxImageCount}
                mediaItems={mediaItems}
                setMediaItems={setMediaItems}
                saving={saving}
                onSave={onSave}
                onPublish={onPublish}
                onDirty={onDirty}
              />
            ) : null}
          </article>
        ))}
        </div>
        {searchLoading ? (
          <p className="py-3 text-center text-sm text-neutral-500" aria-live="polite">
            {t('editor.pool.searching')}
          </p>
        ) : null}
        {!searchLoading && visibleArticles.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-300 px-3 py-5 text-sm text-neutral-500">
            {t(resolveEmptyMessageKey(activeTab, debouncedSearch))}
          </p>
        ) : null}
        {searchResults === null && hasMore ? (
          <PoolLoadMore loadingMore={loadingMore} onLoadMore={onLoadMore} />
        ) : null}
      </div>
    </div>
  )
}

interface IPoolLoadMoreProps {
  loadingMore: boolean
  onLoadMore: () => void
}

/**
 * Auto-loading sentinel and fallback button that pull the next pool page.
 *
 * An IntersectionObserver triggers the next page as the sentinel scrolls into
 * view, keeping the loaded pool bounded until the editor scrolls further.
 *
 * @param props Loading flag and the load-more handler.
 * @returns The load-more footer for the pool.
 */
function PoolLoadMore({ loadingMore, onLoadMore }: IPoolLoadMoreProps): JSX.Element {
  const t = useTranslations('admin')
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMoreRef.current()
      }
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={sentinelRef} className="mt-4 flex justify-center">
      <button
        type="button"
        disabled={loadingMore}
        onClick={onLoadMore}
        className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      >
        {loadingMore ? t('editor.pool.loadingMore') : t('editor.pool.loadMore')}
      </button>
    </div>
  )
}

/**
 * Resolve the `admin` message key for the current empty-state.
 *
 * @param activeTab Which source list is active.
 * @param debouncedSearch Trimmed, debounced search query.
 * @returns Translation key for the empty-state message.
 */
function resolveEmptyMessageKey(activeTab: NewsTabType, debouncedSearch: string): string {
  if (debouncedSearch) {
    return 'editor.pool.empty.search'
  }
  if (activeTab === 'new') {
    return 'editor.pool.empty.new'
  }
  return 'editor.pool.empty.filters'
}

interface INewsTabBarProps {
  activeTab: NewsTabType
  newCount: number
  onTabChange: (tab: NewsTabType) => void
}

const TAB_BASE_CLASS = 'border-b-2 px-1 pb-2 text-sm font-medium transition-colors'

/**
 * Tab switcher between the full article pool and new reporter uploads.
 *
 * @param props Component props.
 * @returns Tab bar UI.
 */
function NewsTabBar(props: INewsTabBarProps): JSX.Element {
  const { activeTab, newCount, onTabChange } = props
  const t = useTranslations('admin')
  return (
    <div className="mb-4 flex gap-4 border-b border-neutral-200" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'all'}
        onClick={() => onTabChange('all')}
        className={`${TAB_BASE_CLASS} ${activeTab === 'all' ? 'border-brand text-brand' : 'border-transparent text-neutral-600 hover:text-neutral-900'}`}
      >
        {t('editor.pool.tabs.all')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'new'}
        onClick={() => onTabChange('new')}
        className={`${TAB_BASE_CLASS} ${activeTab === 'new' ? 'border-brand text-brand' : 'border-transparent text-neutral-600 hover:text-neutral-900'}`}
      >
        {t('editor.pool.tabs.new')}
        {newCount > 0 ? (
          <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
            {newCount}
          </span>
        ) : null}
      </button>
    </div>
  )
}

interface IPlacementFilterButtonsProps {
  activeFilter: PlacementFilterType
  onFilterChange: (filter: PlacementFilterType) => void
}

const PLACEMENT_FILTER_OPTIONS: ReadonlyArray<{ value: PlacementFilterType; labelKey: string }> = [
  { value: 'all', labelKey: 'editor.pool.filters.all' },
  { value: 'unplaced', labelKey: 'editor.pool.filters.unplaced' },
  { value: 'homepage', labelKey: 'editor.pool.filters.homepage' },
]

/**
 * Quick-filter buttons for the All news tab.
 *
 * @param props Component props.
 * @returns Placement filter buttons.
 */
function PlacementFilterButtons(props: IPlacementFilterButtonsProps): JSX.Element {
  const { activeFilter, onFilterChange } = props
  const t = useTranslations('admin')
  return (
    <>
      {PLACEMENT_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onFilterChange(option.value)}
          className={`rounded border px-3 py-2 text-xs font-medium ${activeFilter === option.value ? 'border-brand text-brand' : 'border-neutral-300 text-neutral-700'}`}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </>
  )
}
