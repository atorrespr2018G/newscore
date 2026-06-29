'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSectionLabels } from '@/hooks/use-section-labels'
import type { IArticle } from '@/interfaces/article'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { PlacementOverlay, PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useFeed } from '@/hooks/use-feed'
import {
  ArticleLeadMedia,
} from '@/components/ui/article-lead-media'
import {
  normalizedPositionKey,
  selectHomepageSections,
  splitDefaultHeroArticles,
} from '@/lib/helpers/feed-layout'
import type { IEditorialBandSlots } from '@/lib/helpers/feed-layout'
import { shouldRenderHomepageGridAd } from '@/lib/helpers/homepage-ad-placement'
import { deckBelowTitle } from '@/lib/helpers/text-helpers'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import type { IFeedSlot, IHomepageFeed } from '@/interfaces/feed'

const HomepageEditorialBand = dynamic(
  () => import('@/components/features/homepage-editorial-band').then((m) => m.HomepageEditorialBand),
  { loading: () => <SectionSkeleton /> },
)

const HomepageUsBand = dynamic(
  () => import('@/components/features/homepage-us-band').then((m) => m.HomepageUsBand),
  { loading: () => <SectionSkeleton /> },
)

const HomepageSection = dynamic(
  () => import('@/components/features/homepage-section').then((m) => m.HomepageSection),
  { loading: () => <SectionSkeleton /> },
)

function SectionSkeleton(): JSX.Element {
  return <div className="h-32 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
}

function RightPromo(): JSX.Element {
  const t = useTranslations('home')
  return (
    <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-950">
      <div className="p-4">
        <div className="inline-flex rounded bg-brand px-2 py-1 text-[10px] font-black tracking-[0.24em] text-white">
          NEWSCORE
        </div>
        <h3 className="mt-3 text-xl font-black leading-tight text-white">{t('rightPromo.title')}</h3>
        <p className="mt-2 text-sm font-semibold text-white/80">{t('rightPromo.subtitle')}</p>
      </div>
      <div className="border-t border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">{t('rightPromo.footer')}</p>
      </div>
    </div>
  )
}

function AdRibbon(): JSX.Element {
  const t = useTranslations('common')

  return (
    <section aria-label={t('advertisement')} className="py-4">
      <div
        className="flex min-h-[192px] items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 px-4"
        role="img"
        aria-label={t('advertisement')}
      >
        <span className="text-[11px] font-black tracking-[0.28em] text-neutral-500">{t('advertisement').toUpperCase()}</span>
      </div>
    </section>
  )
}

interface IHeroBlockProps {
  articles: IArticle[]
}

function HeroLeftRail({ articles }: { articles: IArticle[] }): JSX.Element {
  const tHome = useTranslations('home')
  return (
    <aside className="lg:col-span-3">
      <div className="space-y-4">
        {articles.map((article, idx) => (
          <HomepageStoryCard
            key={article.id}
            article={article}
            editorDroppable
            variant="hero-lead"
            kicker={idx === 0 ? tHome('hero.topKicker') : undefined}
            layout="stacked"
            titleFirst={idx === 0}
            showSummary={idx === 0}
          />
        ))}
      </div>
    </aside>
  )
}

function HeroLead({ hero }: { hero: IArticle }): JSX.Element {
  const heroHref = `/article/${encodeURIComponent(hero.slug)}`
  const heroSummary = deckBelowTitle(hero.title, hero.summary, 200)
  return (
    <PlacementOverlay article={hero} editorDroppable>
      <Link href={heroHref} className="group block" aria-label={hero.title}>
        <h2 className="font-sans text-[34px] font-normal leading-[1.05] tracking-tight text-neutral-950">
          {hero.title}
        </h2>

        <div className="mt-4 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <div className="relative aspect-[16/9]">
            <ArticleLeadMedia article={hero} mode="teaser" priority imageSizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
        </div>

        {heroSummary ? (
          <p className="mt-4 font-sans text-sm font-normal leading-relaxed text-neutral-800">
            <span className="line-clamp-3">{heroSummary}</span>
          </p>
        ) : null}
      </Link>
    </PlacementOverlay>
  )
}

function HeroCenter({
  hero,
  relatedLinks,
  strip,
}: {
  hero: IArticle
  relatedLinks: IArticle[]
  strip: IArticle[]
}): JSX.Element {
  return (
    <section className="lg:col-span-6">
      <div className="border-b border-neutral-200 pb-5">
        <HeroLead hero={hero} />

        {relatedLinks.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 pt-2">
            {relatedLinks.map((article) => (
              <HomepageStoryCard
                key={article.id}
                article={article}
                editorDroppable
                variant="headline-only"
              />
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {strip.map((article) => (
          <HomepageStoryCard
            key={article.id}
            article={article}
            editorDroppable
            variant="compact"
            layout="stacked"
          />
        ))}
      </div>
    </section>
  )
}

function HeroRightRail({ articles }: { articles: IArticle[] }): JSX.Element {
  return (
    <aside className="lg:col-span-3">
      <div className="space-y-6">
        <RightPromo />
        <div className="space-y-4">
          {articles.map((article, idx) => (
            <HomepageStoryCard
              key={article.id}
              article={article}
              editorDroppable
              variant="rail"
              titleFirst={idx === 0}
              showSummary={idx === 0}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function HeroBlock({ articles }: IHeroBlockProps): JSX.Element | null {
  const hero = articles[0]
  if (!hero) {
    return (
      <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <PlacementSectionDropZone />
      </div>
    )
  }

  const { left, relatedLinks, strip, rightCards } = splitDefaultHeroArticles(articles)

  return (
    <div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <HeroLeftRail articles={left} />
        <HeroCenter hero={hero} relatedLinks={relatedLinks} strip={strip} />
        <HeroRightRail articles={rightCards} />
      </div>
      <PlacementSectionDropZone />
    </div>
  )
}

/** Post-politics section keys preceded by an ad ribbon on the homepage. */
const POST_POLITICS_AD_SECTION_KEYS = ['health', 'finance', 'technology', 'world'] as const

function EarlyUsSection({ slot, title }: { slot: IFeedSlot | undefined; title: string }): JSX.Element | null {
  if (!slot) {
    return null
  }
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <HomepageUsBand slot={slot} title={title} />
    </Suspense>
  )
}

function TopStoriesSection({ band }: { band: IEditorialBandSlots | undefined }): JSX.Element | null {
  if (!band) {
    return null
  }
  return (
    <div className="space-y-2">
      <AdRibbon />
      <Suspense fallback={<SectionSkeleton />}>
        <HomepageEditorialBand
          moreTopStoriesSlot={band.lead}
          spotlightSlot={band.spotlight}
          rightRailSlot={band.rail}
        />
      </Suspense>
    </div>
  )
}

function PoliticsSportsSection({
  politicsSlot,
  sportsSlot,
}: {
  politicsSlot: IFeedSlot | undefined
  sportsSlot: IFeedSlot | undefined
}): JSX.Element | null {
  if (!politicsSlot && !sportsSlot) {
    return null
  }
  return (
    <div className="space-y-2">
      {politicsSlot ? (
        <>
          <AdRibbon />
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageSection slot={politicsSlot} />
          </Suspense>
        </>
      ) : null}
      {sportsSlot ? (
        <Suspense fallback={<SectionSkeleton />}>
          <HomepageSection slot={sportsSlot} />
        </Suspense>
      ) : null}
    </div>
  )
}

function PostPoliticsSections({ slots }: { slots: IFeedSlot[] }): JSX.Element {
  return (
    <>
      {slots.map((slot) => (
        <div key={slot.id} className="space-y-2">
          {(POST_POLITICS_AD_SECTION_KEYS as readonly string[]).includes(normalizedPositionKey(slot)) ? (
            <AdRibbon />
          ) : null}
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageSection slot={slot} />
          </Suspense>
        </div>
      ))}
    </>
  )
}

function EditorialBandSections({ bands }: { bands: IEditorialBandSlots[] }): JSX.Element {
  return (
    <>
      {bands.map((band) => (
        <div key={`${band.lead.id}-${band.spotlight.id}-${band.rail?.id ?? 'no-rail'}`} className="space-y-2">
          <AdRibbon />
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageEditorialBand
              moreTopStoriesSlot={band.lead}
              spotlightSlot={band.spotlight}
              rightRailSlot={band.rail}
            />
          </Suspense>
        </div>
      ))}
    </>
  )
}

function GridSections({
  slots,
  previousSlot,
}: {
  slots: IFeedSlot[]
  previousSlot: IFeedSlot | undefined
}): JSX.Element {
  return (
    <>
      {slots.map((slot, index) => (
        <div key={slot.id} className="space-y-2">
          {shouldRenderHomepageGridAd(index === 0 ? previousSlot : slots[index - 1], slot) ? <AdRibbon /> : null}
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageSection slot={slot} />
          </Suspense>
        </div>
      ))}
    </>
  )
}

/**
 * Render the homepage module stack from a resolved feed.
 *
 * @param feed Homepage feed with slots and articles.
 * @returns Homepage content without data fetching.
 */
export function HomepageContent({ feed }: { feed: IHomepageFeed }): JSX.Element {
  const { sectionLabel } = useSectionLabels()
  const slots = feed.slots ?? []
  if (slots.length === 0) {
    return (
      <div className="text-neutral-600">
        No homepage slots configured.
      </div>
    )
  }

  const sections = selectHomepageSections(slots)
  const gridPreviousSlot = sections.postPoliticsSlots.at(-1) ?? sections.politicsSlot

  return (
    <div className="space-y-2 [&_a:hover]:text-neutral-950 [&_a:hover]:underline">
      <PlacementSlotScope slotId={sections.heroSlot.id}>
        <HeroBlock articles={sections.heroSlot.articles} />
      </PlacementSlotScope>
      <AdRibbon />
      <EarlyUsSection slot={sections.earlyUsSlot} title={sectionLabel('us-featured')} />
      <TopStoriesSection band={sections.topStoriesBand} />
      <PoliticsSportsSection politicsSlot={sections.politicsSlot} sportsSlot={sections.sportsSlot} />
      <PostPoliticsSections slots={sections.postPoliticsSlots} />
      <EditorialBandSections bands={sections.remainingEditorialBands} />
      <GridSections slots={sections.gridSlots} previousSlot={gridPreviousSlot} />
    </div>
  )
}

/**
 * Render the homepage module stack from the active feed.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Homepage component.
 */
export function Homepage({ initialFeed }: { initialFeed?: IHomepageFeed }): JSX.Element {
  const t = useTranslations('common')
  const { data, loading, error } = useFeed()
  const feedData = data ?? initialFeed

  if (loading && !feedData) return <div className="text-neutral-600">{t('loading')}</div>
  if (error && !feedData) return <div className="text-red-700">{t('failedToLoad', { message: error.message })}</div>

  if (!feedData || feedData.slots.length === 0) {
    return (
      <div className="text-neutral-600">
        {t.rich('noStoriesYet', {
          command: () => <code className="text-sm">{t('seedCommand')}</code>,
        })}
      </div>
    )
  }

  return <HomepageContent feed={feedData} />
}
