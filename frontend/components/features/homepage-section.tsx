'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'
import { sectionAnchorId, sectionLabel } from '@/lib/helpers/section-labels'

interface IHomepageSectionProps {
  slot: IFeedSlot
}

/**
 * CNN-style horizontal module: section heading plus a row of story cards.
 */
export function HomepageSection({ slot }: IHomepageSectionProps): JSX.Element | null {
  const articles = slot.articles
  if (articles.length === 0) {
    return null
  }

  const title = sectionLabel(slot.positionKey)
  const anchorId = sectionAnchorId(slot.positionKey)

  return (
    <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
      <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
        <h2 className="text-2xl font-black tracking-tight text-neutral-950">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest</span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((article) => (
          <SectionStoryCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  )
}

interface ISectionStoryCardProps {
  article: IArticle
}

function SectionStoryCard({ article }: ISectionStoryCardProps): JSX.Element {
  return (
    <article className="group">
      <Link href={`/article/${encodeURIComponent(article.slug)}`} className="block">
        <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <div className="relative aspect-[16/10]">
            <Image
              src={article.thumbnailUrl ?? placeholderImageDataUri(article.slug)}
              alt=""
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              unoptimized
            />
          </div>
        </div>
        <h3 className="mt-3 text-[15px] font-extrabold leading-snug text-neutral-950 group-hover:text-[color:var(--brand-red)]">
          {article.title}
        </h3>
        <p className="mt-1 text-xs font-semibold text-neutral-600">{article.authorName}</p>
      </Link>
    </article>
  )
}
