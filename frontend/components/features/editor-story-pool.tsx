'use client'

import { useEffect, useMemo, useState } from 'react'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
import { editorArticleRowToPreview } from '@/lib/helpers/editor-article-preview'
import {
  formatAllArticlePlacements,
  formatArticlePlacements,
  type IArticlePlacement,
} from '@/lib/helpers/article-placements'

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

interface IEditorStoryPoolProps {
  articles: IEditorStoryRow[]
  selectedId: string | null
  placementMap: Map<string, IArticlePlacement[]>
  onSearch: (query: string) => Promise<IEditorStoryRow[]>
  onSelect: (articleId: string) => void
}

/**
 * Editor list with quick filters and drag handles.
 *
 * @param props Component props.
 * @returns Curated article pool UI.
 */
export function EditorStoryPool(props: IEditorStoryPoolProps): JSX.Element {
  const { articles, selectedId, placementMap, onSearch, onSelect } = props
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<IEditorStoryRow[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [placementFilter, setPlacementFilter] = useState<PlacementFilterType>('all')

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

  const visibleArticles = useMemo(() => {
    return sourceArticles.filter((article) => {
      const placements = placementMap.get(article.id) ?? []
      const isPlaced = placements.length > 0
      const inHomepage = placements.some((placement) => placement.pageName === 'homepage')
      if (placementFilter === 'unplaced' && isPlaced) {
        return false
      }
      if (placementFilter === 'homepage' && !inHomepage) {
        return false
      }
      return true
    })
  }, [placementFilter, placementMap, sourceArticles])

  return (
    <div className="flex flex-col">
      <div className="pb-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
          <label className="text-sm font-medium text-neutral-700">
            Search by title or slug
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search stories"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => setPlacementFilter('all')}
            className={`rounded border px-3 py-2 text-xs font-medium ${placementFilter === 'all' ? 'border-brand text-brand' : 'border-neutral-300 text-neutral-700'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setPlacementFilter('unplaced')}
            className={`rounded border px-3 py-2 text-xs font-medium ${placementFilter === 'unplaced' ? 'border-brand text-brand' : 'border-neutral-300 text-neutral-700'}`}
          >
            Unplaced
          </button>
          <button
            type="button"
            onClick={() => setPlacementFilter('homepage')}
            className={`rounded border px-3 py-2 text-xs font-medium ${placementFilter === 'homepage' ? 'border-brand text-brand' : 'border-neutral-300 text-neutral-700'}`}
          >
            Homepage placed
          </button>
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
                    <dt className="inline font-medium text-neutral-500">ID: </dt>
                    <dd className="inline font-mono text-[11px] text-neutral-700">{article.id}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-500">Status: </dt>
                    <dd className="inline capitalize">{article.status}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-500">Author: </dt>
                    <dd className="inline">{article.author_name}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-500">Location: </dt>
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
            Searching stories…
          </p>
        ) : null}
        {!searchLoading && visibleArticles.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-300 px-3 py-5 text-sm text-neutral-500">
            {debouncedSearch
              ? 'No stories match your search.'
              : 'No stories match the current filters.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
