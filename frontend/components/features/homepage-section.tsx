'use client'

import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { StoryCard } from '@/components/ui/story-card'
import { cardVariantForPresentation } from '@/lib/presentation-registry'
import { sectionAnchorId, sectionLabel } from '@/lib/helpers/section-labels'

interface IHomepageSectionProps {
  slot: IFeedSlot
}

function gridColumnsClass(positionKey: string): string {
  const normalizedKey = positionKey.trim().toLowerCase()
  return normalizedKey === 'politics' || normalizedKey === 'world' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
}

function visibleArticlesForSection(slot: IFeedSlot): IFeedSlot['articles'] {
  const normalizedKey = slot.positionKey.trim().toLowerCase()
  return normalizedKey === 'politics' ? slot.articles.slice(0, 15) : slot.articles
}

function repeatToLength<T>(items: T[], size: number): T[] {
  if (items.length === 0) {
    return []
  }

  return Array.from({ length: size }, (_, index) => items[index % items.length])
}

function buildPoliticsColumns(articles: IArticle[]): Array<{ leadArticle: IArticle; secondaryArticles: IArticle[] }> {
  const leadArticles = repeatToLength(articles.slice(0, 3), 3)

  return leadArticles.map((leadArticle) => {
    const secondaryPool = articles.filter((article) => article.id !== leadArticle.id)

    return {
      leadArticle,
      secondaryArticles: repeatToLength(secondaryPool.length > 0 ? secondaryPool : articles, 4),
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

  const normalizedKey = slot.positionKey.trim().toLowerCase()
  const isPoliticsSection = normalizedKey === 'politics'
  const title = slot.displayName ?? sectionLabel(slot.positionKey)
  const anchorId = sectionAnchorId(slot.positionKey)
  const variant = cardVariantForPresentation(slot.presentationType)
  const desktopGridColumnsClass = gridColumnsClass(slot.positionKey)
  const politicsColumns = isPoliticsSection ? buildPoliticsColumns(articles) : []

  return (
    <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
      <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
        <h2 className="text-2xl font-black tracking-tight text-neutral-950">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest</span>
      </div>
      <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${desktopGridColumnsClass}`}>
        {isPoliticsSection
          ? politicsColumns.map((column, index) => {
              const { leadArticle, secondaryArticles } = column
              if (!leadArticle) {
                return null
              }

              return (
                <div key={`${leadArticle.id}-${index}`} className="space-y-4">
                  <StoryCard article={leadArticle} variant={variant} showAuthor />
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
          : articles.map((article) => <StoryCard key={article.id} article={article} variant={variant} showAuthor />)}
      </div>
    </section>
  )
}
