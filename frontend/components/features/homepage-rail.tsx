'use client'

import { useFeed } from '@/hooks/use-feed'
import { ArticleCard } from '@/components/ui/article-card'
import Link from 'next/link'
import Image from 'next/image'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'
import { excerpt } from '@/lib/helpers/text-helpers'

/**
 * Newsroom-style homepage layout: hero + top stories rail.
 */
export function HomepageRail(): JSX.Element {
  const { data, loading, error } = useFeed()

  if (loading) return <div className="text-neutral-600">Loading…</div>
  if (error) return <div className="text-red-700">Failed to load: {error.message}</div>

  const heroSlot = data?.slots?.[0]
  const articles = heroSlot?.articles ?? []

  const hero = articles[0]
  const rest = articles.slice(1, 6)

  if (!hero) {
    return <div className="text-neutral-600">No stories yet. Run the seed script and refresh.</div>
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      <section className="lg:col-span-8">
        <div className="border-b border-neutral-200 pb-6">
          <p className="text-[11px] font-extrabold tracking-[0.24em] text-[color:var(--brand-red)]">TOP STORY</p>

          <Link href={`/article/${encodeURIComponent(hero.slug)}`} className="mt-3 block">
            <h2 className="text-4xl font-black leading-[1.03] tracking-tight hover:text-[color:var(--brand-red)]">
              {hero.title}
            </h2>
          </Link>

          <p className="mt-3 text-sm font-semibold text-neutral-700">
            {hero.authorName} <span className="font-normal text-neutral-400">• {new Date(hero.publishedAt ?? hero.createdAt).toLocaleString()}</span>
          </p>

          <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
            <div className="relative aspect-[16/9]">
              <Image src={hero.thumbnailUrl ?? placeholderImageDataUri(hero.slug)} alt={hero.title} fill className="object-cover" unoptimized />
            </div>
          </div>

          <p className="mt-5 text-base leading-relaxed text-neutral-800">
            {excerpt(
              'A sharper, denser homepage layout with hero media, a right rail, and section modules. Next we’ll add category pages and richer article rendering.',
              180,
            )}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <section>
            <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
              <h3 className="text-sm font-extrabold tracking-[0.18em] text-neutral-900">LATEST</h3>
              <span className="text-xs font-semibold text-neutral-500">From the feed</span>
            </div>
            <div className="divide-y divide-neutral-200">
              {articles.slice(0, 4).map((a) => (
                <ArticleCard key={a.id} article={a} variant="compact" />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
              <h3 className="text-sm font-extrabold tracking-[0.18em] text-neutral-900">IN DEPTH</h3>
              <span className="text-xs font-semibold text-neutral-500">Featured</span>
            </div>
            <div className="divide-y divide-neutral-200">
              {articles.slice(0, 4).reverse().map((a) => (
                <ArticleCard key={a.id} article={a} variant="compact" />
              ))}
            </div>
          </section>
        </div>
      </section>

      <aside className="lg:col-span-4">
        <div className="sticky top-6">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h3 className="text-sm font-extrabold tracking-[0.18em] text-neutral-900">TOP STORIES</h3>
            <span className="text-xs font-semibold text-neutral-500">Updated</span>
          </div>
          <div className="divide-y divide-neutral-200">
            {rest.map((a) => (
              <ArticleCard key={a.id} article={a} variant="compact" />
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-extrabold tracking-[0.2em] text-neutral-900">WATCHLIST</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-800">
              <li className="flex items-center justify-between">
                <span className="font-semibold">Markets</span>
                <span className="text-neutral-500">Mixed</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-semibold">Weather</span>
                <span className="text-neutral-500">Active</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-semibold">Politics</span>
                <span className="text-neutral-500">Developing</span>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}

