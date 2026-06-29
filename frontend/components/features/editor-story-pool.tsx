'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
import { EditorArticleModal } from '@/components/features/editor-article-modal'
import { clearDraggingArticleId, setDraggingArticleId } from '@/lib/editor/editor-drag-store'
import type { ICategoryOut } from '@/lib/api/category-client'
import type { IStoryGroupOut } from '@/lib/api/story-group-client'
import type { IArticleDetail, ILoadedMedia } from '@/hooks/use-editor-curation'
import { editorArticleRowToPreview } from '@/lib/helpers/editor-article-preview'
import {
  formatAllArticlePlacements,
  formatArticlePlacements,
  type IArticlePlacement,
} from '@/lib/helpers/article-placements'
import {
  EMPTY_EDITOR_SEARCH_FILTERS,
  hasActiveSearchFilters,
  isNewReporterArticle,
  type IEditorSearchFilters,
} from '@/lib/helpers/editor-curation'

const EDITOR_SEARCH_DEBOUNCE_MS = 300

export interface IEditorStoryRow {
  id: string
  title: string
  slug: string
  status: string
  author_name: string
  thumbnail_url: string | null
  category_ids?: string[]
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
  onSearch: (filters: IEditorSearchFilters) => Promise<IEditorStoryRow[]>
  onSelect: (articleId: string) => void
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  storyId: string
  setStoryId: Dispatch<SetStateAction<string>>
  storyGroups: IStoryGroupOut[]
  detail: IArticleDetail | null
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  body: string
  setBody: Dispatch<SetStateAction<string>>
  uploadImages: (files: FileList | null) => void
  uploadVideos: (files: FileList | null) => void
  uploadingMedia: boolean
  maxImageCount: number
  setMaxImageCount: (value: number) => void
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  saving: boolean
  isDirty: boolean
  onSave: () => Promise<boolean>
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
    storyGroups,
    detail,
    title,
    setTitle,
    body,
    setBody,
    uploadImages,
    uploadVideos,
    uploadingMedia,
    maxImageCount,
    setMaxImageCount,
    mediaItems,
    setMediaItems,
    saving,
    isDirty,
    onSave,
    onPublish,
    onDirty,
    hasMore,
    loadingMore,
    onLoadMore,
  } = props
  const t = useTranslations('admin')
  const [isModalOpen, setModalOpen] = useState(false)
  const [filters, setFilters] = useState<IEditorSearchFilters>(EMPTY_EDITOR_SEARCH_FILTERS)
  const [debouncedFilters, setDebouncedFilters] = useState<IEditorSearchFilters>(
    EMPTY_EDITOR_SEARCH_FILTERS,
  )
  const [searchResults, setSearchResults] = useState<IEditorStoryRow[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [placementFilter, setPlacementFilter] = useState<PlacementFilterType>('all')
  const [activeTab, setActiveTab] = useState<NewsTabType>('all')

  // Serialize so the debounce only re-fires when a filter value actually changes.
  const filtersKey = JSON.stringify(filters)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(filters)
    }, EDITOR_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  const searchActive = hasActiveSearchFilters(debouncedFilters)

  useEffect(() => {
    if (!searchActive) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)
    void onSearch(debouncedFilters)
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
  }, [debouncedFilters, searchActive, onSearch])

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

      <PoolFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
        showPlacementFilters={activeTab === 'all'}
        placementFilter={placementFilter}
        onPlacementFilterChange={setPlacementFilter}
      />

      <div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleArticles.map((article) => (
          <article
            key={article.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', article.id)
              // Some browser-to-browser drags expose generic text keys only.
              event.dataTransfer.setData('text', article.id)
              event.dataTransfer.setData('Text', article.id)
              event.dataTransfer.effectAllowed = 'move'
              // Mirror the id to shared storage so the Placement window can read
              // it on drop; native dataTransfer does not cross browser windows.
              setDraggingArticleId(article.id)
            }}
            onDragEnd={() => clearDraggingArticleId()}
            className={[
              'overflow-hidden rounded-lg border bg-white transition-colors',
              selectedId === article.id
                ? 'border-brand ring-1 ring-brand/30'
                : 'border-neutral-200 hover:border-neutral-300',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => {
                onSelect(article.id)
                setModalOpen(true)
              }}
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
            {t(resolveEmptyMessageKey(activeTab, searchActive))}
          </p>
        ) : null}
        {searchResults === null && hasMore ? (
          <PoolLoadMore loadingMore={loadingMore} onLoadMore={onLoadMore} />
        ) : null}
      </div>

      <EditorArticleModal
        isOpen={isModalOpen && selectedId !== null}
        onClose={() => setModalOpen(false)}
        detail={detail}
        title={title}
        setTitle={setTitle}
        body={body}
        setBody={setBody}
        uploadImages={uploadImages}
        uploadVideos={uploadVideos}
        uploadingMedia={uploadingMedia}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={setSelectedCategoryIds}
        internationalPotential={internationalPotential}
        setInternationalPotential={setInternationalPotential}
        storyId={storyId}
        setStoryId={setStoryId}
        storyGroups={storyGroups}
        maxImageCount={maxImageCount}
        setMaxImageCount={setMaxImageCount}
        mediaItems={mediaItems}
        setMediaItems={setMediaItems}
        saving={saving}
        isDirty={isDirty}
        onSave={onSave}
        onPublish={onPublish}
        onDirty={onDirty}
      />
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
 * @param searchActive Whether a backend search is currently applied.
 * @returns Translation key for the empty-state message.
 */
function resolveEmptyMessageKey(activeTab: NewsTabType, searchActive: boolean): string {
  if (searchActive) {
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

/** Tailwind classes for a filter control, greyed out when disabled. */
function filterControlClass(disabled: boolean): string {
  return [
    'mt-1 w-full rounded border px-3 py-2 text-sm',
    disabled ? 'border-neutral-200 bg-neutral-100 text-neutral-400' : 'border-neutral-300',
  ].join(' ')
}

interface IFilterFieldProps {
  label: string
  hint?: string
  children: ReactNode
}

/**
 * Labeled wrapper for a single filter control with an optional hint line.
 *
 * @param props Label text, optional hint, and the control to render.
 * @returns The labeled filter field.
 */
function FilterField({ label, hint, children }: IFilterFieldProps): JSX.Element {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      {children}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-amber-600">{hint}</span>
      ) : null}
    </label>
  )
}

interface IPoolFilterBarProps {
  filters: IEditorSearchFilters
  onFiltersChange: Dispatch<SetStateAction<IEditorSearchFilters>>
  categories: ICategoryOut[]
  showPlacementFilters: boolean
  placementFilter: PlacementFilterType
  onPlacementFilterChange: (filter: PlacementFilterType) => void
}

/**
 * Multi-field filter bar for the story pool (title, category, date range, id).
 *
 * @param props Filter state, change handlers, and category options.
 * @returns The filter bar UI.
 */
function PoolFilterBar(props: IPoolFilterBarProps): JSX.Element {
  const {
    filters,
    onFiltersChange,
    categories,
    showPlacementFilters,
    placementFilter,
    onPlacementFilterChange,
  } = props
  // A news id is an exact-match override; the other filters are ignored while set.
  const overrideActive = filters.newsId.trim() !== ''
  const update = (patch: Partial<IEditorSearchFilters>): void =>
    onFiltersChange((current) => ({ ...current, ...patch }))

  return (
    <div className="space-y-3 pb-4">
      <PoolPrimaryFilters
        filters={filters}
        categories={categories}
        disabled={overrideActive}
        onUpdate={update}
      />
      <PoolIdFilterRow
        filters={filters}
        overrideActive={overrideActive}
        onUpdate={update}
        onClear={() => onFiltersChange(EMPTY_EDITOR_SEARCH_FILTERS)}
      />
      {showPlacementFilters && !overrideActive ? (
        <div className="flex flex-wrap gap-2">
          <PlacementFilterButtons
            activeFilter={placementFilter}
            onFilterChange={onPlacementFilterChange}
          />
        </div>
      ) : null}
    </div>
  )
}

interface IPoolPrimaryFiltersProps {
  filters: IEditorSearchFilters
  categories: ICategoryOut[]
  disabled: boolean
  onUpdate: (patch: Partial<IEditorSearchFilters>) => void
}

/**
 * Title, category, and created-date-range controls of the filter bar.
 *
 * @param props Filter state, categories, disabled flag, and update handler.
 * @returns The primary filter controls grid.
 */
function PoolPrimaryFilters(props: IPoolPrimaryFiltersProps): JSX.Element {
  const { filters, categories, disabled, onUpdate } = props
  const t = useTranslations('admin')

  return (
    <div className="grid gap-3 md:grid-cols-2 md:items-end lg:grid-cols-4">
      <FilterField label={t('editor.pool.filterBar.titleLabel')}>
        <input
          type="text"
          value={filters.title}
          disabled={disabled}
          onChange={(event) => onUpdate({ title: event.target.value })}
          placeholder={t('editor.pool.searchPlaceholder')}
          className={filterControlClass(disabled)}
        />
      </FilterField>
      <FilterField label={t('editor.pool.filterBar.categoryLabel')}>
        <select
          value={filters.categoryId}
          disabled={disabled}
          onChange={(event) => onUpdate({ categoryId: event.target.value })}
          className={filterControlClass(disabled)}
        >
          <option value="">{t('editor.pool.filterBar.categoryAll')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label={t('editor.pool.filterBar.dateFromLabel')}>
        <input
          type="date"
          value={filters.createdFrom}
          disabled={disabled}
          onChange={(event) => onUpdate({ createdFrom: event.target.value })}
          className={filterControlClass(disabled)}
        />
      </FilterField>
      <FilterField label={t('editor.pool.filterBar.dateToLabel')}>
        <input
          type="date"
          value={filters.createdTo}
          disabled={disabled}
          onChange={(event) => onUpdate({ createdTo: event.target.value })}
          className={filterControlClass(disabled)}
        />
      </FilterField>
    </div>
  )
}

interface IPoolIdFilterRowProps {
  filters: IEditorSearchFilters
  overrideActive: boolean
  onUpdate: (patch: Partial<IEditorSearchFilters>) => void
  onClear: () => void
}

/**
 * News-id exact-match field plus the clear-all-filters button.
 *
 * @param props Filter state, override flag, update handler, and clear handler.
 * @returns The id filter row.
 */
function PoolIdFilterRow(props: IPoolIdFilterRowProps): JSX.Element {
  const { filters, overrideActive, onUpdate, onClear } = props
  const t = useTranslations('admin')

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <FilterField
        label={t('editor.pool.filterBar.newsIdLabel')}
        hint={overrideActive ? t('editor.pool.filterBar.newsIdOverride') : undefined}
      >
        <input
          type="text"
          value={filters.newsId}
          onChange={(event) => onUpdate({ newsId: event.target.value })}
          placeholder={t('editor.pool.filterBar.newsIdPlaceholder')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs"
        />
      </FilterField>
      <button
        type="button"
        onClick={onClear}
        className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {t('editor.pool.filterBar.clear')}
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
