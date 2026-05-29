'use client'

import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { StoryCard } from '@/components/ui/story-card'
import { sectionAnchorId, sectionLabel } from '@/lib/helpers/section-labels'

export const MORE_TOP_STORIES_KEY = 'more-top-stories'

interface IHomepageEditorialBandProps {
  moreTopStoriesSlot: IFeedSlot
  spotlightSlot: IFeedSlot
  rightRailSlot?: IFeedSlot
}

/**
 * CNN-style three-column band below the hero: More Top Stories | spotlight topic | ads + rail stories.
 */
export function HomepageEditorialBand({
  moreTopStoriesSlot,
  spotlightSlot,
  rightRailSlot,
}: IHomepageEditorialBandProps): JSX.Element | null {
  const moreArticles = moreTopStoriesSlot.articles
  const spotlightArticles = spotlightSlot.articles

  if (moreArticles.length === 0 && spotlightArticles.length === 0) {
    return null
  }

  return (
    <section
      id={sectionAnchorId(MORE_TOP_STORIES_KEY)}
      className="scroll-mt-24 border-t border-neutral-200 pt-10"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
        {moreArticles.length > 0 ? (
          <div className="lg:col-span-3">
            <EditorialColumn
              title={moreTopStoriesSlot.displayName ?? sectionLabel(moreTopStoriesSlot.positionKey)}
              articles={moreArticles}
              leadImageCount={3}
            />
          </div>
        ) : null}

        {spotlightArticles.length > 0 ? (
          <div className="lg:col-span-6">
            <EditorialColumn
              title={spotlightSlot.displayName ?? sectionLabel(spotlightSlot.positionKey)}
              articles={spotlightArticles}
              leadImageCount={1}
            />
          </div>
        ) : null}

        <div className="lg:col-span-3">
          <RightRailColumn articles={rightRailSlot?.articles ?? []} />
        </div>
      </div>
    </section>
  )
}

interface IEditorialColumnProps {
  title: string
  articles: IArticle[]
  leadImageCount: number
}

function EditorialColumn({ title, articles, leadImageCount }: IEditorialColumnProps): JSX.Element {
  const leads = articles.slice(0, leadImageCount)
  const headlines = articles.slice(leadImageCount)

  return (
    <div className="flex flex-col">
      <h2 className="border-b-2 border-neutral-950 pb-2 text-xl font-black tracking-tight text-neutral-950">
        {title}
      </h2>

      <div className="mt-4 space-y-4">
        {leads.map((article) => (
          <StoryCard key={article.id} article={article} variant="rail" />
        ))}
      </div>

      {headlines.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-200">
          {headlines.map((article) => (
            <StoryCard key={article.id} article={article} variant="headline-only" />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const RIGHT_RAIL_LEAD_IMAGE_COUNT = 3

function RightRailColumn({ articles }: { articles: IArticle[] }): JSX.Element {
  const leads = articles.slice(0, RIGHT_RAIL_LEAD_IMAGE_COUNT)
  const headlines = articles.slice(RIGHT_RAIL_LEAD_IMAGE_COUNT)

  return (
    <div className="flex flex-col" aria-label="Sponsored and featured stories">
      <div className="space-y-4">
        <AdUnit />
        <AdUnit tall />
      </div>

      {leads.length > 0 || headlines.length > 0 ? (
        <div className="mt-4 space-y-4">
          {leads.map((article) => (
            <StoryCard key={article.id} article={article} variant="compact" layout="side" />
          ))}
        </div>
      ) : null}

      {headlines.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {headlines.map((article) => (
            <StoryCard key={article.id} article={article} variant="headline-only" compact />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function AdUnit({ tall = false }: { tall?: boolean }): JSX.Element {
  return (
    <div
      className={[
        'rounded border border-neutral-200 bg-neutral-100',
        tall ? 'min-h-[280px]' : 'min-h-[120px]',
      ].join(' ')}
      role="img"
      aria-label="Advertisement"
    />
  )
}
