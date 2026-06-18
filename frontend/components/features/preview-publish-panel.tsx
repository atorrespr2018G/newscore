'use client'

import { useMemo, useState } from 'react'
import { apiConfig } from '@/lib/api/config'
import { publishHomepagePlacements } from '@/lib/api/layout-client'
import { apiFetch } from '@/lib/api/rest-client'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import { collectUnpublishedPreviewArticles } from '@/lib/helpers/preview-publish-articles'
import type { IHomepageFeed } from '@/interfaces/feed'

interface IPreviewPublishPanelProps {
  feed: IHomepageFeed | null
  hasUnpublishedPlacements: boolean
  onPublished: () => Promise<void>
}

/**
 * Publishing controls for the standalone homepage preview page.
 *
 * @param props Component props.
 * @returns Panel with homepage and story publish actions.
 */
export function PreviewPublishPanel(props: IPreviewPublishPanelProps): JSX.Element {
  const { feed, hasUnpublishedPlacements, onPublished } = props
  const [publishingHomepage, setPublishingHomepage] = useState(false)
  const [publishingArticleId, setPublishingArticleId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unpublishedArticles = useMemo(() => collectUnpublishedPreviewArticles(feed), [feed])

  async function publishHomepageChanges(): Promise<void> {
    setPublishingHomepage(true)
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
      notifyEditorialPreviewStale()
      await onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish homepage placements')
    } finally {
      setPublishingHomepage(false)
    }
  }

  async function publishArticle(articleId: string, title: string): Promise<void> {
    setPublishingArticleId(articleId)
    setError(null)
    setMessage(null)
    try {
      await apiFetch(`${apiConfig.news}/articles/${articleId}/publish`, { method: 'POST' })
      setMessage(`Published "${title}".`)
      notifyEditorialPreviewStale()
      await onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish article')
    } finally {
      setPublishingArticleId(null)
    }
  }

  const isPublishing = publishingHomepage || publishingArticleId !== null

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-serif text-lg font-semibold">Publishing</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Publish staged homepage layout changes and unpublished stories shown in this preview.
      </p>

      <div className="mt-4 space-y-4">
        <div
          className={[
            'flex flex-wrap items-center justify-between gap-3 rounded px-4 py-3',
            hasUnpublishedPlacements ? 'border border-amber-200 bg-amber-50' : 'border border-neutral-200 bg-neutral-50',
          ].join(' ')}
        >
          <div>
            <p className="text-sm font-medium text-neutral-900">Homepage layout</p>
            <p className="mt-1 text-xs text-neutral-600">
              {hasUnpublishedPlacements
                ? 'Staged placement changes are ready to publish.'
                : 'No staged homepage placement changes.'}
            </p>
          </div>
          <button
            type="button"
            disabled={isPublishing || !hasUnpublishedPlacements}
            onClick={() => void publishHomepageChanges()}
            className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {publishingHomepage ? 'Publishing…' : 'Publish homepage'}
          </button>
        </div>

        <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm font-medium text-neutral-900">Unpublished stories in preview</p>
          {unpublishedArticles.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No draft or review stories in this preview.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {unpublishedArticles.map((article) => (
                <li
                  key={article.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{article.title}</p>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">{article.status}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => void publishArticle(article.id, article.title)}
                    className="shrink-0 rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
                  >
                    {publishingArticleId === article.id ? 'Publishing…' : 'Publish'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
    </section>
  )
}
