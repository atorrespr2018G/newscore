'use client'

import type { IArticleDetail } from '@/interfaces/article'
import { useArticle } from '@/hooks/use-article'
import { StoryFollowups } from '@/components/features/story-followups'
import { ArticleBodyLayout, ArticleHeader } from '@/components/features/article-reading-view'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feed-state'
import { useTranslations } from 'next-intl'

interface IArticleClientProps {
  slug: string
  initialArticle?: IArticleDetail
}

/**
 * Render the interactive article detail view for the current slug.
 *
 * @param props - The article slug and optional server-rendered payload.
 * @returns The article detail layout or a loading/error state.
 */
export function ArticleClient({ slug, initialArticle }: IArticleClientProps): JSX.Element {
  const t = useTranslations('common')
  const { data, loading, error } = useArticle(slug)
  const article = data ?? initialArticle

  if (loading && !article) {
    return <LoadingState message={t('loading')} />
  }
  if (error && !article) {
    return <ErrorState message={t('failedToLoad', { message: error.message })} />
  }
  if (!article) {
    return <EmptyState>{t('notFound')}</EmptyState>
  }

  return (
    <article>
      <ArticleHeader article={article} />
      <ArticleBodyLayout article={article} />
      <StoryFollowups updates={article.storyUpdates} />
    </article>
  )
}
