'use client'

import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { HomepageCompactSixBand } from '@/components/features/homepage-compact-six-band'
import { HealthCarouselSection } from '@/components/features/homepage-health-carousel'
import { HomepageUsBand } from '@/components/features/homepage-us-band'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { PlacementSlotScope, useEditorPlacement } from '@/context/editor-placement-context'
import { PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useMarket } from '@/context/market-context'
import { cardVariantForPresentation } from '@/lib/presentation-registry'
import { toRegionCode } from '@/lib/region-code'
import { useSectionLabels } from '@/hooks/use-section-labels'
import {
  COMPACT_SIX_BAND_EXTENDED_LIMIT,
  isCompactSixBandPositionKey,
  isUsBandPositionKey,
  sectionAnchorId,
} from '@/lib/helpers/section-labels'
import { useTranslations } from 'next-intl'
import { worldArchiveHref } from '@/lib/helpers/world-archive'
import { ArchiveSectionLink } from '@/components/ui/archive-section-link'

interface IHomepageSectionProps {
  slot: IFeedSlot
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
}

const FEATURED_COLUMN_SECTION_KEYS = new Set<string>()
const FEATURED_COLUMN_ARTICLE_LIMIT = 15
const HEALTH_CAROUSEL_ARTICLE_LIMIT = 20
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
 *
 * Carousels remount when the market/town/county scope changes so arrows and
 * slide position always start at the default (first page, left).
 */
export function HomepageSection({ slot, pageName }: IHomepageSectionProps): JSX.Element | null {
  const { homepageSectionTitle, sectionLabel } = useSectionLabels(pageName)
  const { marketCode, town, county } = useMarket()
  const carouselScopeKey = toRegionCode(marketCode, town, county)
  const t = useTranslations('common')
  const editor = useEditorPlacement()
  const articles = visibleArticlesForSection(slot)
  const showEmptyPlacementShell = articles.length === 0 && editor != null
  if (articles.length === 0 && !showEmptyPlacementShell) {
    return null
  }

  if (slot.presentationType.trim().toLowerCase() === 'live_carousel') {
    return (
      <HealthCarouselSection
        key={carouselScopeKey}
        slot={{ ...slot, articles: slot.articles.slice(0, HEALTH_CAROUSEL_ARTICLE_LIMIT) }}
      />
    )
  }

  if (slot.positionKey.trim().toLowerCase() === 'health' && !isCompactSixBandPositionKey(slot.positionKey, pageName)) {
    return (
      <HealthCarouselSection
        key={carouselScopeKey}
        slot={{ ...slot, articles: slot.articles.slice(0, HEALTH_CAROUSEL_ARTICLE_LIMIT) }}
      />
    )
  }

  if (slot.presentationType.trim().toLowerCase() === 'featured_band') {
    return (
      <HomepageUsBand
        slot={slot}
        title={slot.displayName?.trim() || sectionLabel(slot.positionKey)}
      />
    )
  }

  if (isCompactSixBandPositionKey(slot.positionKey, pageName)) {
    return (
      <HomepageCompactSixBand
        key={carouselScopeKey}
        slot={{ ...slot, articles: slot.articles.slice(0, COMPACT_SIX_BAND_EXTENDED_LIMIT) }}
        pageName={pageName}
      />
    )
  }

  if (slot.positionKey.trim().toLowerCase() === 'world') {
    return <HomepageUsBand slot={slot} title={sectionLabel('world')} />
  }

  if (isUsBandPositionKey(slot.positionKey)) {
    return <HomepageUsBand slot={slot} />
  }

  const usesFeaturedColumns = usesFeaturedColumnLayout(slot.positionKey)
  const title = homepageSectionTitle(slot.positionKey, slot.displayName)
  const archiveHref = worldArchiveHref(pageName, slot.positionKey)
  const anchorId = sectionAnchorId(slot.positionKey)
  const variant = cardVariantForPresentation(slot.presentationType)
  const desktopGridColumnsClass = gridColumnsClass(slot.positionKey)
  const featuredColumns = usesFeaturedColumns ? buildFeaturedColumns(articles) : []

  return (
    <PlacementSlotScope slotId={slot.id}>
      <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
        <SectionGridHeading
          title={title}
          latestLabel={t('latest')}
          href={archiveHref}
          plainTitle={pageName === 'world'}
        />
        {articles.length > 0 ? (
          <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${desktopGridColumnsClass}`}>
            {usesFeaturedColumns
              ? featuredColumns.map((column, index) => {
                  const { leadArticle, secondaryArticles } = column
                  if (!leadArticle) {
                    return null
                  }

                  return (
                    <div key={`${leadArticle.id}-${index}`} className="space-y-4">
                      <HomepageStoryCard article={leadArticle} variant={variant} showAuthor editorDroppable />
                      <div className="space-y-4">
                        {secondaryArticles.map((article, secondaryIndex) => (
                          <HomepageStoryCard
                            key={`${article.id}-${index}-${secondaryIndex}`}
                            article={article}
                            variant="compact"
                            layout="side"
                            editorDroppable
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
                    editorDroppable
                  />
                ))}
          </div>
        ) : null}
        <PlacementSectionDropZone />
      </section>
    </PlacementSlotScope>
  )
}

/**
 * Grid-section heading. On World, the title and Latest link to the region archive.
 *
 * @param props Heading copy, latest label, optional archive href, and title weight.
 * @returns Section heading row.
 */
function SectionGridHeading({
  title,
  latestLabel,
  href,
  plainTitle,
}: {
  title: string
  latestLabel: string
  href: string | null
  plainTitle: boolean
}): JSX.Element {
  const latestClassName = 'text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500'
  const titleClassName = [
    'text-2xl tracking-tight text-neutral-950',
    plainTitle ? 'font-normal' : 'font-black',
  ].join(' ')

  return (
    <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
      <h2 className={titleClassName}>
        {href ? (
          <ArchiveSectionLink href={href} className="hover:underline">
            {title}
          </ArchiveSectionLink>
        ) : (
          title
        )}
      </h2>
      {href ? (
        <ArchiveSectionLink href={href} className={`${latestClassName} hover:underline`}>
          {latestLabel}
        </ArchiveSectionLink>
      ) : (
        <span className={latestClassName}>{latestLabel}</span>
      )}
    </div>
  )
}
