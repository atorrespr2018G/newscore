'use client'

import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { HomepageCompactSixBand } from '@/components/features/homepage-compact-six-band'
import { HealthCarouselSection } from '@/components/features/homepage-health-carousel'
import { HomepageUsBand } from '@/components/features/homepage-us-band'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { cardVariantForPresentation } from '@/lib/presentation-registry'
import { useSectionLabels } from '@/hooks/use-section-labels'
import {
  COMPACT_SIX_BAND_EXTENDED_LIMIT,
  isCompactSixBandPositionKey,
  isUsBandPositionKey,
  sectionAnchorId,
} from '@/lib/helpers/section-labels'
import { useTranslations } from 'next-intl'

interface IHomepageSectionProps {
  slot: IFeedSlot
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
}

const FEATURED_COLUMN_SECTION_KEYS = new Set<string>()
const FEATURED_COLUMN_ARTICLE_LIMIT = 15
const HEALTH_CAROUSEL_ARTICLE_LIMIT = 6
const FEATURED_COLUMN_COUNT = 3
const FEATURED_COLUMN_SECONDARY_COUNT = 4
function usesFeaturedColumnLayout(positionKey: string): boolean {
  return FEATURED_COLUMN_SECTION_KEYS.has(positionKey.trim().toLowerCase())
}

function gridColumnsClass(positionKey: string): string {
  return usesFeaturedColumnLayout(positionKey) ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
}

function visibleArticlesForSection(slot: IFeedSlot): IFeedSlot['articles'] {
  return usesFeaturedColumnLayout(slot.positionKey)
    ? slot.articles.slice(0, FEATURED_COLUMN_ARTICLE_LIMIT)
    : slot.articles
}

function repeatToLength<T>(items: T[], size: number): T[] {
  if (items.length === 0) {
    return []
  }

  return Array.from({ length: size }, (_, index) => items[index % items.length])
}

function buildFeaturedColumns(articles: IArticle[]): Array<{ leadArticle: IArticle; secondaryArticles: IArticle[] }> {
  const leadArticles = repeatToLength(articles.slice(0, FEATURED_COLUMN_COUNT), FEATURED_COLUMN_COUNT)

  return leadArticles.map((leadArticle) => {
    const secondaryPool = articles.filter((article) => article.id !== leadArticle.id)

    return {
      leadArticle,
      secondaryArticles: repeatToLength(
        secondaryPool.length > 0 ? secondaryPool : articles,
        FEATURED_COLUMN_SECONDARY_COUNT,
      ),
    }
  })
}

/**
 * CNN-style horizontal module: section heading plus a row of story cards.
 */
export function HomepageSection({ slot, pageName }: IHomepageSectionProps): JSX.Element | null {
  const { homepageSectionTitle, sectionLabel } = useSectionLabels(pageName)
  const t = useTranslations('common')
  const articles = visibleArticlesForSection(slot)
  if (articles.length === 0) {
    return null
  }

  if (slot.positionKey.trim().toLowerCase() === 'health') {
    return (
      <HealthCarouselSection
        slot={{ ...slot, articles: slot.articles.slice(0, HEALTH_CAROUSEL_ARTICLE_LIMIT) }}
      />
    )
  }

  if (isCompactSixBandPositionKey(slot.positionKey)) {
    return (
      <HomepageCompactSixBand
        slot={{ ...slot, articles: slot.articles.slice(0, COMPACT_SIX_BAND_EXTENDED_LIMIT) }}
        pageName={pageName}
      />
    )
  }

  if (isUsBandPositionKey(slot.positionKey)) {
    return <HomepageUsBand slot={slot} />
  }

  if (slot.positionKey.trim().toLowerCase() === 'world') {
    return <HomepageUsBand slot={slot} title={sectionLabel('world')} />
  }

  const usesFeaturedColumns = usesFeaturedColumnLayout(slot.positionKey)
  const title = homepageSectionTitle(slot.positionKey, slot.displayName)
  const anchorId = sectionAnchorId(slot.positionKey)
  const variant = cardVariantForPresentation(slot.presentationType)
  const desktopGridColumnsClass = gridColumnsClass(slot.positionKey)
  const featuredColumns = usesFeaturedColumns ? buildFeaturedColumns(articles) : []

  return (
    <PlacementSlotScope slotId={slot.id}>
      <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
        <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
          <h2
            className={[
              'text-2xl tracking-tight text-neutral-950',
              pageName === 'world' ? 'font-normal' : 'font-black',
            ].join(' ')}
          >
            {title}
          </h2>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{t('latest')}</span>
        </div>
        <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${desktopGridColumnsClass}`}>
          {usesFeaturedColumns
            ? featuredColumns.map((column, index) => {
                const { leadArticle, secondaryArticles } = column
                if (!leadArticle) {
                  return null
                }

                return (
                  <div key={`${leadArticle.id}-${index}`} className="space-y-4">
                    <HomepageStoryCard article={leadArticle} variant={variant} showAuthor />
                    <div className="space-y-4">
                      {secondaryArticles.map((article, secondaryIndex) => (
                        <HomepageStoryCard
                          key={`${article.id}-${index}-${secondaryIndex}`}
                          article={article}
                          variant="compact"
                          layout="side"
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            : articles.map((article) => (
                <HomepageStoryCard
                  key={article.id}
                  article={article}
                  variant={variant}
                  showAuthor
                />
              ))}
        </div>
        <PlacementSectionDropZone />
      </section>
    </PlacementSlotScope>
  )
}
