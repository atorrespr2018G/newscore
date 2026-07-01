'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiConfig } from '@/lib/api/config'
import { publishHomepagePlacements } from '@/lib/api/layout-client'
import { apiFetch } from '@/lib/api/rest-client'
import { useReviewQueue } from '@/hooks/use-review-queue'
import { notifyWorkflowBadgesRefresh } from '@/lib/api/workflow-badges-client'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import { collectUnpublishedPreviewArticles } from '@/lib/helpers/preview-publish-articles'
import type { IReviewArticle } from '@/lib/helpers/review-queue'
import type { IArticle } from '@/interfaces/article'
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
 * @returns Panel with homepage, review, and draft publish actions.
 */
export function PreviewPublishPanel(props: IPreviewPublishPanelProps): JSX.Element {
  const { feed, hasUnpublishedPlacements, onPublished } = props
  const t = useTranslations('admin')
  const reviewQueue = useReviewQueue()
  const [publishingHomepage, setPublishingHomepage] = useState(false)
  const [publishingArticleId, setPublishingArticleId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const draftArticles = useMemo(
    () => collectUnpublishedPreviewArticles(feed).filter((article) => article.status === 'draft'),
    [feed],
  )

  const isPublishing = publishingHomepage || publishingArticleId !== null || reviewQueue.workingId !== null
  const panelMessage = message ?? reviewQueue.message
  const panelError = error ?? reviewQueue.error

  async function publishHomepageChanges(): Promise<void> {
    setPublishingHomepage(true)
    setError(null)
    setMessage(null)
    try {
      const result = await publishHomepagePlacements()
      setMessage(
        result.published_slot_count === 0
          ? t('preview.panel.homepage.none')
          : t('preview.panel.homepage.published', { count: result.published_slot_count }),
      )
      notifyEditorialPreviewStale()
      notifyWorkflowBadgesRefresh()
      await onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.errors.publishPlacements'))
    } finally {
      setPublishingHomepage(false)
    }
  }

  async function publishDraftArticle(articleId: string, title: string): Promise<void> {
    setPublishingArticleId(articleId)
    setError(null)
    setMessage(null)
    try {
      await apiFetch(`${apiConfig.news}/articles/${articleId}/publish`, { method: 'POST' })
      setMessage(t('preview.panel.drafts.published', { title }))
      notifyEditorialPreviewStale()
      notifyWorkflowBadgesRefresh()
      await onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.errors.publish'))
    } finally {
      setPublishingArticleId(null)
    }
  }

  async function handleReviewAction(
    action: (article: IReviewArticle) => Promise<void>,
    article: IReviewArticle,
  ): Promise<void> {
    setError(null)
    setMessage(null)
    await action(article)
    notifyEditorialPreviewStale()
    notifyWorkflowBadgesRefresh()
    await onPublished()
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-serif text-lg font-semibold">{t('preview.panel.heading')}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t('preview.panel.description')}</p>

      <div className="mt-4 space-y-4">
        <HomepageLayoutPublishRow
          hasUnpublishedPlacements={hasUnpublishedPlacements}
          isPublishing={isPublishing}
          publishingHomepage={publishingHomepage}
          onPublish={() => void publishHomepageChanges()}
        />

        <ReviewQueueSection
          rows={reviewQueue.rows}
          loading={reviewQueue.loading}
          workingId={reviewQueue.workingId}
          isPublishing={isPublishing}
          onApprove={(article) => void handleReviewAction(reviewQueue.approve, article)}
          onSendBack={(article) => void handleReviewAction(reviewQueue.sendBack, article)}
        />

        <DraftStoriesSection
          articles={draftArticles}
          isPublishing={isPublishing}
          publishingArticleId={publishingArticleId}
          onPublish={(article) => void publishDraftArticle(article.id, article.title)}
        />
      </div>

      {panelError ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {panelError}
        </p>
      ) : null}
      {panelMessage ? (
        <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
          {panelMessage}
        </p>
      ) : null}
    </section>
  )
}

interface IHomepageLayoutPublishRowProps {
  hasUnpublishedPlacements: boolean
  isPublishing: boolean
  publishingHomepage: boolean
  onPublish: () => void
}

/**
 * Publish staged homepage placement changes from the preview panel.
 *
 * @param props Row props.
 * @returns Homepage layout publish row.
 */
function HomepageLayoutPublishRow(props: IHomepageLayoutPublishRowProps): JSX.Element {
  const { hasUnpublishedPlacements, isPublishing, publishingHomepage, onPublish } = props
  const t = useTranslations('admin')

  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-3 rounded px-4 py-3',
        hasUnpublishedPlacements ? 'border border-amber-200 bg-amber-50' : 'border border-neutral-200 bg-neutral-50',
      ].join(' ')}
    >
      <div>
        <p className="text-sm font-medium text-neutral-900">{t('preview.panel.homepage.heading')}</p>
        <p className="mt-1 text-xs text-neutral-600">
          {hasUnpublishedPlacements
            ? t('preview.panel.homepage.ready')
            : t('preview.panel.homepage.noneStaged')}
        </p>
      </div>
      <button
        type="button"
        disabled={isPublishing || !hasUnpublishedPlacements}
        onClick={onPublish}
        className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {publishingHomepage ? t('preview.panel.homepage.publishing') : t('preview.panel.homepage.publish')}
      </button>
    </div>
  )
}

interface IReviewQueueSectionProps {
  rows: IReviewArticle[]
  loading: boolean
  workingId: string | null
  isPublishing: boolean
  onApprove: (article: IReviewArticle) => void
  onSendBack: (article: IReviewArticle) => void
}

/**
 * List stories awaiting manual approval with approve and send-back actions.
 *
 * @param props Section props.
 * @returns Review queue section.
 */
function ReviewQueueSection(props: IReviewQueueSectionProps): JSX.Element {
  const { rows, loading, workingId, isPublishing, onApprove, onSendBack } = props
  const t = useTranslations('admin')

  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-sm font-medium text-neutral-900">{t('review.heading')}</p>
      <p className="mt-1 text-xs text-neutral-600">{t('review.subtitle')}</p>
      {loading ? (
        <p className="mt-2 text-sm text-neutral-500">{t('review.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{t('review.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((article) => (
            <ReviewQueueRow
              key={article.id}
              article={article}
              working={workingId === article.id}
              isPublishing={isPublishing}
              onApprove={() => onApprove(article)}
              onSendBack={() => onSendBack(article)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface IReviewQueueRowProps {
  article: IReviewArticle
  working: boolean
  isPublishing: boolean
  onApprove: () => void
  onSendBack: () => void
}

/**
 * Single review-queue row with approve and send-back controls.
 *
 * @param props Row props.
 * @returns Review queue row.
 */
function ReviewQueueRow(props: IReviewQueueRowProps): JSX.Element {
  const { article, working, isPublishing, onApprove, onSendBack } = props
  const t = useTranslations('admin')

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">{article.title}</p>
        <p className="mt-1 text-xs text-neutral-600">
          <span className="font-medium text-neutral-500">{t('review.row.author')} </span>
          {article.author_name}
        </p>
        <p className="font-mono text-[11px] text-neutral-400">
          <span className="font-sans font-medium text-neutral-500">{t('review.row.id')} </span>
          {article.id}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPublishing}
          onClick={onApprove}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {working ? t('review.actions.working') : t('review.actions.approve')}
        </button>
        <button
          type="button"
          disabled={isPublishing}
          onClick={onSendBack}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          {t('review.actions.sendBack')}
        </button>
      </div>
    </li>
  )
}

interface IDraftStoriesSectionProps {
  articles: IArticle[]
  isPublishing: boolean
  publishingArticleId: string | null
  onPublish: (article: IArticle) => void
}

/**
 * List draft stories visible in the homepage preview with publish actions.
 *
 * @param props Section props.
 * @returns Draft stories section.
 */
function DraftStoriesSection(props: IDraftStoriesSectionProps): JSX.Element {
  const { articles, isPublishing, publishingArticleId, onPublish } = props
  const t = useTranslations('admin')

  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-sm font-medium text-neutral-900">{t('preview.panel.drafts.heading')}</p>
      {articles.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{t('preview.panel.drafts.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {articles.map((article) => (
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
                onClick={() => onPublish(article)}
                className="shrink-0 rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
              >
                {publishingArticleId === article.id
                  ? t('preview.panel.drafts.publishing')
                  : t('preview.panel.drafts.publish')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
