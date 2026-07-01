'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import {
  approveArticle,
  sendArticleBack,
  type IArticleWorkflowResult,
} from '@/lib/api/article-workflow-client'
import { fetchReviewArticles, type IReviewArticle } from '@/lib/helpers/review-queue'

/** Editorial workflow transition that resolves to an updated article. */
type ArticleTransitionType = (articleId: string) => Promise<IArticleWorkflowResult>

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

export interface IReviewQueue {
  rows: IReviewArticle[]
  loading: boolean
  error: string | null
  message: string | null
  workingId: string | null
  approve: (article: IReviewArticle) => Promise<void>
  sendBack: (article: IReviewArticle) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Load and manage the review queue plus its approve/send-back transitions.
 *
 * @returns Review queue state and transition actions.
 */
export function useReviewQueue(): IReviewQueue {
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
    (article: IReviewArticle) => runTransition(article, APPROVE_TRANSITION),
    [runTransition],
  )
  const sendBack = useCallback(
    (article: IReviewArticle) => runTransition(article, SEND_BACK_TRANSITION),
    [runTransition],
  )

  return { rows, loading, error, message, workingId, approve, sendBack, refresh: load }
}
