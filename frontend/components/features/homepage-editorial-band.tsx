'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
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
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
        {moreArticles.length > 0 ? (
          <EditorialColumn
            title={moreTopStoriesSlot.displayName ?? sectionLabel(moreTopStoriesSlot.positionKey)}
            articles={moreArticles}
            leadImageCount={3}
          />
        ) : null}

        {spotlightArticles.length > 0 ? (
          <EditorialColumn
            title={spotlightSlot.displayName ?? sectionLabel(spotlightSlot.positionKey)}
            articles={spotlightArticles}
            leadImageCount={1}
          />
        ) : null}

        <RightRailColumn articles={rightRailSlot?.articles ?? []} />
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
          <VerticalImageStory key={article.id} article={article} />
        ))}
      </div>

      {headlines.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-200">
          {headlines.map((article) => (
            <HeadlineListItem key={article.id} article={article} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function CompactSideStory({ article }: { article: IArticle }): JSX.Element {
  return (
    <article>
      <Link
        href={`/article/${encodeURIComponent(article.slug)}`}
        className="group grid grid-cols-[112px_1fr] items-stretch gap-3"
      >
        <HomepageStoryThumb article={article} className="shrink-0 border-0" />
        <div className="flex min-w-0 items-center py-3 pr-3">
          <p className="text-[13px] font-extrabold leading-snug text-neutral-950 group-hover:text-[color:var(--brand-red)]">
            {article.title}
          </p>
        </div>
      </Link>
    </article>
  )
}

function VerticalImageStory({ article }: { article: IArticle }): JSX.Element {
  return (
    <article className="group">
      <Link href={`/article/${encodeURIComponent(article.slug)}`} className="block">
        <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <div className="relative aspect-[16/10]">
            <Image
              src={article.thumbnailUrl ?? placeholderImageDataUri(article.slug)}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              unoptimized
            />
          </div>
        </div>
        <h3 className="mt-2 text-[15px] font-extrabold leading-snug text-neutral-950 group-hover:text-[color:var(--brand-red)]">
          {article.title}
        </h3>
      </Link>
    </article>
  )
}

function HeadlineListItem({ article, compact = false }: { article: IArticle; compact?: boolean }): JSX.Element {
  return (
    <li>
      <Link
        href={`/article/${encodeURIComponent(article.slug)}`}
        className={[
          'block text-[14px] font-extrabold leading-snug text-neutral-950 hover:text-[color:var(--brand-red)]',
          compact ? '' : 'py-3',
        ].join(' ')}
      >
        {article.title}
      </Link>
    </li>
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
            <CompactSideStory key={article.id} article={article} />
          ))}
        </div>
      ) : null}

      {headlines.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {headlines.map((article) => (
            <HeadlineListItem key={article.id} article={article} compact />
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
