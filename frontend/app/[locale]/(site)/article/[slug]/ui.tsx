'use client'

import type { IArticleDetail } from '@/interfaces/article'
import { useArticle } from '@/hooks/use-article'
import { StoryFollowups } from '@/components/features/story-followups'
import { ArticleBodyLayout, ArticleHeader } from '@/components/features/article-reading-view'
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
    return <div className="text-neutral-600">{t('loading')}</div>
  }
  if (error && !article) {
    return <div className="text-red-700">{t('failedToLoad', { message: error.message })}</div>
  }
  if (!article) {
    return <div className="text-neutral-600">{t('notFound')}</div>
  }

  return (
    <article>
      <ArticleHeader article={article} />
      <ArticleBodyLayout article={article} />
      <StoryFollowups updates={article.storyUpdates} />
    </article>
  )
}
