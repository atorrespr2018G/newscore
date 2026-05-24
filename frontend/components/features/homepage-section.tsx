'use client'

import type { IFeedSlot } from '@/interfaces/feed'
import { StoryCard } from '@/components/ui/story-card'
import { cardVariantForPresentation } from '@/lib/presentation-registry'
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

  const title = slot.displayName ?? sectionLabel(slot.positionKey)
  const anchorId = sectionAnchorId(slot.positionKey)
  const variant = cardVariantForPresentation(slot.presentationType)

  return (
    <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
      <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
        <h2 className="text-2xl font-black tracking-tight text-neutral-950">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest</span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((article) => (
          <StoryCard key={article.id} article={article} variant={variant} showAuthor />
        ))}
      </div>
    </section>
  )
}
