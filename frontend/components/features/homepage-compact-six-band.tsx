'use client'

import type { IFeedSlot } from '@/interfaces/feed'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { COMPACT_SIX_BAND_ARTICLE_LIMIT, sectionAnchorId } from '@/lib/helpers/section-labels'
import { useTranslations } from 'next-intl'

interface IHomepageCompactSixBandProps {
  slot: IFeedSlot
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
}

/**
 * Six compact picture story cards in one row on large screens, within the standard section footprint.
 */
export function HomepageCompactSixBand({ slot, pageName }: IHomepageCompactSixBandProps): JSX.Element | null {
  const { homepageSectionTitle } = useSectionLabels(pageName)
  const t = useTranslations('common')
  const articles = slot.articles.slice(0, COMPACT_SIX_BAND_ARTICLE_LIMIT)
  if (articles.length === 0) {
    return null
  }

  const title = homepageSectionTitle(slot.positionKey, slot.displayName)
  const anchorId = sectionAnchorId(slot.positionKey)

  return (
    <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
      <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
        <h2 className="text-2xl font-normal tracking-tight text-neutral-950">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{t('latest')}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
        {articles.map((article) => (
          <HomepageStoryCard
            key={article.id}
            article={article}
            variant="grid"
            plainTitle
            titleClassName="text-[13px]"
          />
        ))}
      </div>
    </section>
  )
}
