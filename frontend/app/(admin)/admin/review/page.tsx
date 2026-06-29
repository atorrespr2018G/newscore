'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import {
  approveArticle,
  sendArticleBack,
  type IArticleWorkflowResult,
} from '@/lib/api/article-workflow-client'
import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import { EDITOR_FETCH_PAGE_SIZE, fetchAllPaginatedArticles } from '@/lib/helpers/editor-curation'
import { useMarkWorkflowViewSeen } from '@/hooks/use-workflow-badges'

/** Lifecycle status for stories awaiting editorial approval. */
const REVIEW_STATUS = 'review'

/** Subset of article fields rendered in the review queue. */
interface IReviewArticle {
  id: string
  title: string
  author_name: string
}

/** Editorial workflow transition that resolves to an updated article. */
type ArticleTransitionType = (articleId: string) => Promise<IArticleWorkflowResult>

/**
 * Fetch every article currently awaiting review.
 *
 * @returns Review-status articles reduced to their display fields.
 * @throws ApiError When the articles request fails.
 */
async function fetchReviewArticles(): Promise<IReviewArticle[]> {
  const rows = await fetchAllPaginatedArticles(
    (page) =>
      `${apiConfig.news}/articles?${new URLSearchParams({
        page: String(page),
        page_size: String(EDITOR_FETCH_PAGE_SIZE),
      }).toString()}`,
    (url) => apiFetch(url),
  )
  return rows
    .filter((row) => row.status === REVIEW_STATUS)
    .map((row) => ({ id: row.id, title: row.title, author_name: row.author_name }))
}

interface IReviewQueue {
  rows: IReviewArticle[]
  loading: boolean
  error: string | null
  message: string | null
  workingId: string | null
  approve: (article: IReviewArticle) => void
  sendBack: (article: IReviewArticle) => void
}

/**
 * Load and manage the review queue plus its approve/send-back transitions.
 *
 * @returns Review queue state and transition actions.
 */
function useReviewQueue(): IReviewQueue {
  const t = useTranslations('admin')
  const [rows, setRows] = useState<IReviewArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchReviewArticles())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('review.errors.load'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const runTransition = useCallback(
    async (article: IReviewArticle, transition: IReviewTransition) => {
      setWorkingId(article.id)
      setError(null)
      setMessage(null)
      try {
        await transition.action(article.id)
        setMessage(t(transition.statusKey, { title: article.title }))
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : t(transition.errorKey))
      } finally {
        setWorkingId(null)
      }
    },
    [load, t],
  )

  const approve = useCallback(
    (article: IReviewArticle) => void runTransition(article, APPROVE_TRANSITION),
    [runTransition],
  )
  const sendBack = useCallback(
    (article: IReviewArticle) => void runTransition(article, SEND_BACK_TRANSITION),
    [runTransition],
  )

  return { rows, loading, error, message, workingId, approve, sendBack }
}

/** A review transition paired with its localized status/error message keys. */
interface IReviewTransition {
  action: ArticleTransitionType
  statusKey: string
  errorKey: string
}

const APPROVE_TRANSITION: IReviewTransition = {
  action: approveArticle,
  statusKey: 'review.status.approved',
  errorKey: 'review.errors.approve',
}

const SEND_BACK_TRANSITION: IReviewTransition = {
  action: sendArticleBack,
  statusKey: 'review.status.sentBack',
  errorKey: 'review.errors.sendBack',
}

/**
 * Editorial review queue: approve stories to publish or send them back to draft.
 *
 * @returns Localized review workflow page.
 */
export default function ReviewPage(): JSX.Element {
  const t = useTranslations('admin')
  const { rows, loading, error, message, workingId, approve, sendBack } = useReviewQueue()
  useMarkWorkflowViewSeen('review')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('review.heading')}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t('review.subtitle')}</p>

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
        <p className="mt-8 text-neutral-600">{t('review.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded border border-dashed border-neutral-300 px-3 py-5 text-sm text-neutral-500">
          {t('review.empty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((article) => (
            <ReviewRow
              key={article.id}
              article={article}
              working={workingId === article.id}
              onApprove={() => approve(article)}
              onSendBack={() => sendBack(article)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface IReviewRowProps {
  article: IReviewArticle
  working: boolean
  onApprove: () => void
  onSendBack: () => void
}

/**
 * Single review-queue row with approve and send-back controls.
 *
 * @param props Article data, busy flag, and transition handlers.
 * @returns The review row UI.
 */
function ReviewRow({ article, working, onApprove, onSendBack }: IReviewRowProps): JSX.Element {
  const t = useTranslations('admin')

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="min-w-0">
        <h2 className="font-serif text-base font-semibold text-neutral-900">{article.title}</h2>
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
          disabled={working}
          onClick={onApprove}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {working ? t('review.actions.working') : t('review.actions.approve')}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={onSendBack}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          {t('review.actions.sendBack')}
        </button>
      </div>
    </li>
  )
}
