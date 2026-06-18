'use client'

import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
import { COMPACT_SIDE_THUMB_WIDTH } from '@/components/ui/story-card'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { useSectionLabels } from '@/hooks/use-section-labels'
import {
  EDITORIAL_COMPACT_IMAGE_COUNT,
  EDITORIAL_LEAD_IMAGE_COUNT,
  isMoreTopStoriesPositionKey,
  MORE_TOP_STORIES_PINNED_LIMIT,
  splitEditorialLeadColumnArticles,
} from '@/lib/helpers/feed-layout'
import { sectionAnchorId } from '@/lib/helpers/section-labels'
import { useTranslations } from 'next-intl'

export const MORE_TOP_STORIES_KEY = 'more-top-stories'

interface IHomepageEditorialBandProps {
  moreTopStoriesSlot: IFeedSlot
  spotlightSlot: IFeedSlot
  rightRailSlot?: IFeedSlot
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
  /** Omit text-only headline links in the lead column (e.g. World USA/Canada). */
  hideLeadHeadlineLinks?: boolean
  /** Picture story with side thumbnail at the bottom of each editorial column (World regions). */
  showTrailingNewsScreen?: boolean
}

/**
 * CNN-style three-column band below the hero: More Top Stories | spotlight topic | Today rail or ads + stories.
 */
export function HomepageEditorialBand({
  moreTopStoriesSlot,
  spotlightSlot,
  rightRailSlot,
  pageName,
  hideLeadHeadlineLinks = false,
  showTrailingNewsScreen = false,
}: IHomepageEditorialBandProps): JSX.Element | null {
  const { homepageSectionTitle } = useSectionLabels(pageName)
  const moreArticles = isMoreTopStoriesPositionKey(moreTopStoriesSlot.positionKey)
    ? moreTopStoriesSlot.articles.slice(0, MORE_TOP_STORIES_PINNED_LIMIT)
    : moreTopStoriesSlot.articles
  const spotlightArticles = spotlightSlot.articles

  if (moreArticles.length === 0 && spotlightArticles.length === 0) {
    return null
  }

  return (
    <section
      id={sectionAnchorId(moreTopStoriesSlot.positionKey)}
      className="scroll-mt-24 border-t border-neutral-200 pt-10"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
        {moreArticles.length > 0 ? (
          <EditorialColumn
            title={homepageSectionTitle(moreTopStoriesSlot.positionKey, moreTopStoriesSlot.displayName)}
            articles={moreArticles}
            leadImageCount={1}
            showHeadlineLinks={!hideLeadHeadlineLinks}
            showTrailingNewsScreen={showTrailingNewsScreen}
            maxArticles={
              isMoreTopStoriesPositionKey(moreTopStoriesSlot.positionKey)
                ? MORE_TOP_STORIES_PINNED_LIMIT
                : undefined
            }
          />
        ) : null}

        {spotlightArticles.length > 0 ? (
          <EditorialColumn
            title={homepageSectionTitle(spotlightSlot.positionKey, spotlightSlot.displayName)}
            articles={spotlightArticles}
            leadImageCount={1}
            showTrailingNewsScreen={showTrailingNewsScreen}
          />
        ) : null}

        <RightRailColumn
          title={
            rightRailSlot
              ? homepageSectionTitle(rightRailSlot.positionKey, rightRailSlot.displayName)
              : undefined
          }
          positionKey={rightRailSlot?.positionKey}
          articles={rightRailSlot?.articles ?? []}
          showTrailingNewsScreen={showTrailingNewsScreen}
        />
      </div>
    </section>
  )
}

interface IEditorialColumnProps {
  title: string
  articles: IArticle[]
  leadImageCount: number
  showHeadlineLinks?: boolean
  showTrailingNewsScreen?: boolean
  /** Optional article cap before splitting into lead, compact, and headline zones. */
  maxArticles?: number
}

const COMPACT_SIDE_THUMB_WIDTH_ENLARGED = Math.round(COMPACT_SIDE_THUMB_WIDTH * 1.2)
const EDITORIAL_STORY_CARD_PROPS = { plainTitle: true } as const

function splitEditorialColumnArticles(
  articles: IArticle[],
  leadImageCount: number,
  showHeadlineLinks: boolean,
  showTrailingNewsScreen: boolean,
  maxArticles?: number,
): {
  leads: IArticle[]
  compacts: IArticle[]
  headlines: IArticle[]
  trailingArticle: IArticle | undefined
} {
  if (
    leadImageCount === EDITORIAL_LEAD_IMAGE_COUNT
    && showHeadlineLinks
    && !showTrailingNewsScreen
  ) {
    const { leads, compacts, headlines } = splitEditorialLeadColumnArticles(articles, maxArticles ?? null)
    return { leads, compacts, headlines, trailingArticle: undefined }
  }

  const leads = articles.slice(0, leadImageCount)
  const compacts = articles.slice(leadImageCount, leadImageCount + EDITORIAL_COMPACT_IMAGE_COUNT)
  const remaining = articles.slice(leadImageCount + EDITORIAL_COMPACT_IMAGE_COUNT)

  if (!showTrailingNewsScreen || remaining.length === 0) {
    return {
      leads,
      compacts,
      headlines: showHeadlineLinks ? remaining : [],
      trailingArticle: undefined,
    }
  }

  if (!showHeadlineLinks) {
    return {
      leads,
      compacts,
      headlines: [],
      trailingArticle: remaining[0],
    }
  }

  if (remaining.length === 1) {
    return {
      leads,
      compacts,
      headlines: [],
      trailingArticle: remaining[0],
    }
  }

  return {
    leads,
    compacts,
    headlines: remaining.slice(0, -1),
    trailingArticle: remaining[remaining.length - 1],
  }
}

function EditorialColumn({
  title,
  articles,
  leadImageCount,
  showHeadlineLinks = true,
  showTrailingNewsScreen = false,
  maxArticles,
}: IEditorialColumnProps): JSX.Element {
  const { leads, compacts, headlines, trailingArticle } = splitEditorialColumnArticles(
    articles,
    leadImageCount,
    showHeadlineLinks,
    showTrailingNewsScreen,
    maxArticles,
  )

  return (
    <div className="flex flex-col">
      <h2 className="border-b-2 border-neutral-950 pb-2 text-xl font-normal tracking-tight text-neutral-950">
        {title}
      </h2>

      <div className="mt-4 space-y-4">
        {leads.map((article) => (
          <HomepageStoryCard key={article.id} article={article} variant="rail" {...EDITORIAL_STORY_CARD_PROPS} />
        ))}
      </div>

      {compacts.length > 0 ? (
        <div className="mt-4 space-y-4">
          {compacts.map((article) => (
            <HomepageStoryCard
              key={article.id}
              article={article}
              variant="compact"
              layout="side"
              sideThumbWidth={COMPACT_SIDE_THUMB_WIDTH_ENLARGED}
              {...EDITORIAL_STORY_CARD_PROPS}
            />
          ))}
        </div>
      ) : null}

      {showHeadlineLinks && headlines.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-200">
          {headlines.map((article) => (
            <HomepageStoryCard
              key={article.id}
              article={article}
              variant="headline-only"
              {...EDITORIAL_STORY_CARD_PROPS}
            />
          ))}
        </ul>
      ) : null}

      {trailingArticle ? (
        <div className="mt-4">
          <HomepageStoryCard
            article={trailingArticle}
            variant="compact"
            layout="side"
            sideThumbWidth={COMPACT_SIDE_THUMB_WIDTH_ENLARGED}
            {...EDITORIAL_STORY_CARD_PROPS}
          />
        </div>
      ) : null}
    </div>
  )
}

const RIGHT_RAIL_LEAD_IMAGE_COUNT = 3
const TODAY_RAIL_POSITION_KEY = 'editorial-rail'

function isTodayRailColumn(positionKey: string | undefined): boolean {
  return positionKey?.trim().toLowerCase() === TODAY_RAIL_POSITION_KEY
}

function RightRailColumn({
  title,
  positionKey,
  articles,
  showTrailingNewsScreen = false,
}: {
  title?: string
  positionKey?: string
  articles: IArticle[]
  showTrailingNewsScreen?: boolean
}): JSX.Element {
  const tHome = useTranslations('home')
  const sponsoredAndFeaturedLabel = tHome('editorialBand.sponsoredAndFeatured')
  const usesNewsScreen = isTodayRailColumn(positionKey)
  const featuredArticle = usesNewsScreen ? articles[0] : undefined
  const railArticles = usesNewsScreen ? articles.slice(1) : articles
  const railPool =
    showTrailingNewsScreen && railArticles.length > RIGHT_RAIL_LEAD_IMAGE_COUNT
      ? railArticles.slice(0, -1)
      : railArticles
  const trailingArticle =
    showTrailingNewsScreen && railArticles.length > RIGHT_RAIL_LEAD_IMAGE_COUNT
      ? railArticles[railArticles.length - 1]
      : undefined
  const leads = railPool.slice(0, RIGHT_RAIL_LEAD_IMAGE_COUNT)
  const headlines = railPool.slice(RIGHT_RAIL_LEAD_IMAGE_COUNT)

  return (
    <div className="flex flex-col" aria-label={title ?? sponsoredAndFeaturedLabel}>
      {title ? (
        <h2 className="border-b-2 border-neutral-950 pb-2 text-xl font-normal tracking-tight text-neutral-950">
          {title}
        </h2>
      ) : null}

      {usesNewsScreen ? (
        featuredArticle ? (
          <div className={title ? 'mt-4' : undefined}>
            <TodayFeaturedNewsScreen article={featuredArticle} />
          </div>
        ) : null
      ) : (
        <div className={title ? 'mt-4 space-y-4' : 'space-y-4'}>
          <AdUnit />
          <AdUnit tall />
        </div>
      )}

      {usesNewsScreen && headlines.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-200">
          {headlines.map((article) => (
            <HomepageStoryCard
              key={article.id}
              article={article}
              variant="headline-only"
              compact
              {...EDITORIAL_STORY_CARD_PROPS}
            />
          ))}
        </ul>
      ) : null}

      {leads.length > 0 ? (
        <div className="mt-4 space-y-4">
          {leads.map((article) => (
            <HomepageStoryCard
              key={article.id}
              article={article}
              variant="compact"
              layout="side"
              sideThumbWidth={usesNewsScreen ? COMPACT_SIDE_THUMB_WIDTH_ENLARGED : undefined}
              {...EDITORIAL_STORY_CARD_PROPS}
            />
          ))}
        </div>
      ) : null}

      {!usesNewsScreen && headlines.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {headlines.map((article) => (
            <HomepageStoryCard
              key={article.id}
              article={article}
              variant="headline-only"
              compact
              {...EDITORIAL_STORY_CARD_PROPS}
            />
          ))}
        </ul>
      ) : null}

      {trailingArticle ? (
        <div className="mt-4">
          <HomepageStoryCard
            article={trailingArticle}
            variant="compact"
            layout="side"
            sideThumbWidth={usesNewsScreen ? COMPACT_SIDE_THUMB_WIDTH_ENLARGED : undefined}
            {...EDITORIAL_STORY_CARD_PROPS}
          />
        </div>
      ) : null}
    </div>
  )
}

function TodayFeaturedNewsScreen({ article }: { article: IArticle }): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`

  return (
    <article className="group">
      <Link href={href} className="block" aria-label={article.title}>
        <HomepageStoryThumb article={article} />
      </Link>
    </article>
  )
}

function AdUnit({ tall = false }: { tall?: boolean }): JSX.Element {
  const t = useTranslations('common')

  return (
    <div
      className={[
        'rounded border border-neutral-200 bg-neutral-100',
        tall ? 'min-h-[280px]' : 'min-h-[120px]',
      ].join(' ')}
      role="img"
      aria-label={t('advertisement')}
    />
  )
}
