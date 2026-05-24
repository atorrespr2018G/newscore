'use client'

import type { IArticleDetail } from '@/interfaces/article'
import { useArticle } from '@/hooks/use-article'

interface IArticleClientProps {
  slug: string
  initialArticle?: IArticleDetail
}

export function ArticleClient({ slug, initialArticle }: IArticleClientProps): JSX.Element {
  const { data, loading, error } = useArticle(slug)
  const article = data ?? initialArticle

  if (loading && !article) {
    return <div className="text-neutral-600">Loading…</div>
  }
  if (error && !article) {
    return <div className="text-red-700">Failed to load: {error.message}</div>
  }
  if (!article) {
    return <div className="text-neutral-600">Not found.</div>
  }

  return (
    <article>
      <h1 className="text-3xl font-extrabold leading-tight">{article.title}</h1>
      <p className="mt-3 text-sm text-neutral-600">
        By {article.authorName} • {new Date(article.publishedAt ?? article.createdAt).toLocaleString()}
      </p>
      <div className="prose prose-neutral mt-8 max-w-none">
        <p className="whitespace-pre-wrap">{article.body}</p>
      </div>
    </article>
  )
}
