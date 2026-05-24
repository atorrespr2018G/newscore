'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'

interface IArticleRow {
  id: string
  title: string
  slug: string
  status: string
  author_name: string
  published_at: string | null
}

interface IPaginatedArticles {
  items: IArticleRow[]
  total: number
  page: number
  page_size: number
}

export default function AdminDashboardPage(): JSX.Element {
  const [articles, setArticles] = useState<IArticleRow[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadArticles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<IPaginatedArticles>(
        `${apiConfig.news}/articles?page=1&page_size=20`,
      )
      setArticles(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

  async function publishArticle(id: string) {
    try {
      await apiFetch(`${apiConfig.news}/articles/${id}/publish`, { method: 'POST' })
      await loadArticles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Articles</h1>
        <p className="text-sm text-neutral-600">{total} total</p>
      </div>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-neutral-600">Loading articles…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{article.title}</p>
                    <p className="text-xs text-neutral-500">{article.slug}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{article.status}</td>
                  <td className="px-4 py-3">{article.author_name}</td>
                  <td className="px-4 py-3">
                    {article.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => void publishArticle(article.id)}
                        className="rounded border border-brand px-2 py-1 text-xs font-medium text-brand hover:bg-brand/5"
                      >
                        Publish
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {articles.length === 0 ? (
            <p className="px-4 py-8 text-center text-neutral-500">No articles yet.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
