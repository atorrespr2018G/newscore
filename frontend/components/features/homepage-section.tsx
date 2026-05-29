'use client'

import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { StoryCard } from '@/components/ui/story-card'
import { cardVariantForPresentation } from '@/lib/presentation-registry'
import { sectionAnchorId, sectionLabel } from '@/lib/helpers/section-labels'

interface IHomepageSectionProps {
  slot: IFeedSlot
}

const FEATURED_COLUMN_SECTION_KEYS = new Set(['politics', 'world'])
const FEATURED_COLUMN_ARTICLE_LIMIT = 15
const FEATURED_COLUMN_COUNT = 3
const FEATURED_COLUMN_SECONDARY_COUNT = 4
const POLITICS_REPLACE_LEAD_WITH_AD_COLUMN_INDEX = 2

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
export function HomepageSection({ slot }: IHomepageSectionProps): JSX.Element | null {
  const articles = visibleArticlesForSection(slot)
  if (articles.length === 0) {
    return null
  }

  const usesFeaturedColumns = usesFeaturedColumnLayout(slot.positionKey)
  const isPolitics = slot.positionKey.trim().toLowerCase() === 'politics'
  const title = slot.displayName ?? sectionLabel(slot.positionKey)
  const anchorId = sectionAnchorId(slot.positionKey)
  const variant = cardVariantForPresentation(slot.presentationType)
  const desktopGridColumnsClass = gridColumnsClass(slot.positionKey)
  const featuredColumns = usesFeaturedColumns ? buildFeaturedColumns(articles) : []

  return (
    <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
      <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
        <h2 className="text-2xl font-black tracking-tight text-neutral-950">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest</span>
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
                  {isPolitics && index === POLITICS_REPLACE_LEAD_WITH_AD_COLUMN_INDEX ? (
                    <InlineAdCard />
                  ) : (
                    <StoryCard article={leadArticle} variant={variant} showAuthor />
                  )}
                  <div className="space-y-4">
                    {secondaryArticles.map((article, secondaryIndex) => (
                      <StoryCard
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
              <StoryCard
                key={article.id}
                article={article}
                variant={variant}
                showAuthor
              />
            ))}
      </div>
    </section>
  )
}

function InlineAdCard(): JSX.Element {
  return (
    <div
      className="overflow-hidden rounded border border-neutral-200 bg-neutral-100"
      role="img"
      aria-label="Advertisement"
    >
      <div className="relative w-full aspect-[16/11.7]">
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <span className="text-[11px] font-black tracking-[0.28em] text-neutral-500">ADVERTISEMENT</span>
        </div>
      </div>
    </div>
  )
}
