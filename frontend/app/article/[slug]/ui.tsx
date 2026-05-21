'use client'

import { useArticle } from '@/hooks/use-article'

interface IArticleClientProps {
  slug: string
}

export function ArticleClient({ slug }: IArticleClientProps): JSX.Element {
  const { data, loading, error } = useArticle(slug)

  if (loading) return <div className="text-white/70">Loading…</div>
  if (error) return <div className="text-red-300">Failed to load: {error.message}</div>
  if (!data) return <div className="text-white/70">Not found.</div>

  return (
    <article>
      <h1 className="text-3xl font-extrabold leading-tight">{data.title}</h1>
      <p className="mt-3 text-sm text-white/70">
        By {data.authorName} • {new Date(data.publishedAt ?? data.createdAt).toLocaleString()}
      </p>
      <div className="prose prose-invert mt-8 max-w-none">
        <p className="whitespace-pre-wrap">{data.body}</p>
      </div>
    </article>
  )
}

