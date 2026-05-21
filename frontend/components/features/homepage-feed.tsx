'use client'

import { useFeed } from '@/hooks/use-feed'
import { ArticleCard } from '@/components/ui/article-card'

/**
 * Data-connected homepage feed renderer.
 */
export function HomepageFeed(): JSX.Element {
  const { data, loading, error } = useFeed()

  if (loading) {
    return <div className="text-white/70">Loading feed…</div>
  }

  if (error) {
    return <div className="text-red-300">Failed to load feed: {error.message}</div>
  }

  if (!data || data.slots.length === 0) {
    return <div className="text-white/70">No feed configured yet.</div>
  }

  return (
    <div className="space-y-10">
      {data.slots.map((slot) => (
        <section key={slot.id}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">{slot.positionKey || slot.contentType}</h2>
            <span className="text-xs text-white/50">{slot.contentType}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {slot.articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

