'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import type { IArticle } from '@/interfaces/article'
import { useFeed } from '@/hooks/use-feed'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'
import { excerpt } from '@/lib/helpers/text-helpers'
import { StoryCard } from '@/components/ui/story-card'
import type { IFeedSlot, IHomepageFeed } from '@/interfaces/feed'
import {
  PRESENTATION_EDITORIAL_LEAD,
  PRESENTATION_EDITORIAL_SPOTLIGHT,
  PRESENTATION_GRID_4,
  PRESENTATION_HERO,
  PRESENTATION_RAIL_COMPACT,
} from '@/lib/presentation-registry'

const HomepageEditorialBand = dynamic(
  () => import('@/components/features/homepage-editorial-band').then((m) => m.HomepageEditorialBand),
  { loading: () => <SectionSkeleton /> },
)

const HomepageSection = dynamic(
  () => import('@/components/features/homepage-section').then((m) => m.HomepageSection),
  { loading: () => <SectionSkeleton /> },
)

function SectionSkeleton(): JSX.Element {
  return <div className="h-32 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
}

interface IRightPromoProps {
  title: string
  subtitle: string
}

function RightPromo({ title, subtitle }: IRightPromoProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-950">
      <div className="p-4">
        <div className="inline-flex rounded bg-brand px-2 py-1 text-[10px] font-black tracking-[0.24em] text-white">
          NEWSCORE
        </div>
        <h3 className="mt-3 text-xl font-black leading-tight text-white">{title}</h3>
        <p className="mt-2 text-sm font-semibold text-white/80">{subtitle}</p>
      </div>
      <div className="border-t border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Catch up on today’s headlines</p>
      </div>
    </div>
  )
}

function AdRibbon(): JSX.Element {
  return (
    <section aria-label="Advertisement" className="border-y border-neutral-200 py-4">
      <div
        className="flex min-h-[192px] items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 px-4"
        role="img"
        aria-label="Advertisement"
      >
        <span className="text-[11px] font-black tracking-[0.28em] text-neutral-500">ADVERTISEMENT</span>
      </div>
    </section>
  )
}

interface IHeroBlockProps {
  articles: IArticle[]
}

function HeroBlock({ articles }: IHeroBlockProps): JSX.Element | null {
  const hero = articles[0]
  if (!hero) {
    return null
  }

  const left = [articles[1], articles[2], articles[6]].filter(Boolean) as IArticle[]
  const relatedLinks = articles.slice(3, 6).filter(Boolean) as IArticle[]
  const strip = articles.slice(6, 9).filter(Boolean) as IArticle[]
  const rightCards = [articles[7], articles[8]].filter(Boolean) as IArticle[]
  const heroImg = articleImageSrc(hero)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <aside className="lg:col-span-3">
        <div className="space-y-4">
          {left.map((article, idx) => (
            <StoryCard
              key={article.id}
              article={article}
              variant="hero-lead"
              kicker={idx === 0 ? 'Top' : undefined}
              layout="stacked"
            />
          ))}
        </div>
      </aside>

      <section className="lg:col-span-6">
        <div className="border-b border-neutral-200 pb-5">
          <Link href={`/article/${encodeURIComponent(hero.slug)}`} className="group">
            <h2 className="text-[34px] font-black leading-[1.05] tracking-tight text-neutral-950 group-hover:text-brand">
              {hero.title}
            </h2>
          </Link>

          <div className="mt-4 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
            <div className="relative aspect-[16/9]">
              <Image
                src={heroImg}
                alt={hero.title}
                fill
                className="object-cover"
                unoptimized={isDataUri(heroImg)}
              />
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-neutral-800">
            {excerpt(
              'Dense three-column homepage with a dominant hero, a sub-story strip, and a right promo rail.',
              200,
            )}
          </p>

          {relatedLinks.length > 0 ? (
            <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 pt-2">
              {relatedLinks.map((article) => (
                <StoryCard key={article.id} article={article} variant="headline-only" />
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {strip.map((article) => (
            <StoryCard key={article.id} article={article} variant="compact" layout="stacked" />
          ))}
        </div>
      </section>

      <aside className="lg:col-span-3">
        <div className="space-y-6">
          <RightPromo title="Headlines" subtitle="The big stories, fast." />
          <div className="space-y-4">
            {rightCards.map((article) => (
              <StoryCard key={article.id} article={article} variant="rail" />
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

function findSlot(slots: IFeedSlot[], presentationType: string): IFeedSlot | undefined {
  return slots.find((s) => s.presentationType === presentationType)
}

export function Homepage({ initialFeed }: { initialFeed?: IHomepageFeed }): JSX.Element {
  const { data, loading, error } = useFeed()
  const feedData = data ?? initialFeed

  if (loading && !feedData) return <div className="text-neutral-600">Loading…</div>
  if (error && !feedData) return <div className="text-red-700">Failed to load: {error.message}</div>

  const slots = feedData?.slots ?? []
  if (slots.length === 0) {
    return (
      <div className="text-neutral-600">
        No stories yet. Run <code className="text-sm">docker compose exec admin_app python seed_dev.py</code> and
        refresh.
      </div>
    )
  }

  const heroSlot = findSlot(slots, PRESENTATION_HERO) ?? slots[0]
  const editorialLeadSlot = findSlot(slots, PRESENTATION_EDITORIAL_LEAD)
  const editorialSpotlightSlot = findSlot(slots, PRESENTATION_EDITORIAL_SPOTLIGHT)
  const railSlot = findSlot(slots, PRESENTATION_RAIL_COMPACT)
  const gridSlots = slots.filter((s) => s.presentationType === PRESENTATION_GRID_4)

  return (
    <div className="space-y-2">
      <HeroBlock articles={heroSlot.articles} />
      <AdRibbon />
      {editorialLeadSlot && editorialSpotlightSlot ? (
        <Suspense fallback={<SectionSkeleton />}>
          <HomepageEditorialBand
            moreTopStoriesSlot={editorialLeadSlot}
            spotlightSlot={editorialSpotlightSlot}
            rightRailSlot={railSlot}
          />
        </Suspense>
      ) : null}
      {gridSlots.map((slot) => (
        <Suspense key={slot.id} fallback={<SectionSkeleton />}>
          <HomepageSection slot={slot} />
        </Suspense>
      ))}
    </div>
  )
}
