'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense, type ComponentType } from 'react'
import type { IArticle } from '@/interfaces/article'
import { usePageFeed } from '@/hooks/use-page-feed'
import { ArticleLeadMedia } from '@/components/ui/article-lead-media'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { useTranslations } from 'next-intl'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'
import {
  buildEditorialBands,
  editorialSlotIds,
  findSlot,
  normalizedPositionKey,
  splitDefaultHeroArticles,
} from '@/lib/helpers/feed-layout'
import { belowMediaTextClass, deckBelowTitle } from '@/lib/helpers/text-helpers'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import {
  COMPACT_SIDE_THUMB_HEIGHT,
  COMPACT_SIDE_THUMB_WIDTH,
  StoryCard,
  type IStoryCardProps,
} from '@/components/ui/story-card'
import type { IFeedSlot, IHomepageFeed } from '@/interfaces/feed'
import {
  PRESENTATION_GRID_4,
  PRESENTATION_HERO,
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

function HeroRailAd(): JSX.Element {
  const t = useTranslations('common')

  return (
    <div
      className="flex min-h-[250px] items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 px-4"
      role="img"
      aria-label={t('advertisement')}
    >
      <span className="text-[11px] font-black tracking-[0.28em] text-neutral-500">{t('advertisement').toUpperCase()}</span>
    </div>
  )
}

function HeroPictureNewsScreen({
  article,
  plainStoryTitles = false,
}: {
  article: IArticle
  plainStoryTitles?: boolean
}): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`
  const imgSrc = articleImageSrc(article)

  return (
    <article className="group">
      <Link href={href} className="block">
        <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={imgSrc}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              unoptimized={isDataUri(imgSrc)}
              sizes="(max-width: 1024px) 100vw, 25vw"
            />
          </div>
        </div>
        <h3
          className={[
            plainStoryTitles
              ? 'mt-2 overflow-hidden font-sans text-[15px] font-normal leading-snug text-neutral-950 group-hover:underline'
              : 'mt-2 overflow-hidden text-[15px] font-extrabold leading-snug text-neutral-950 group-hover:text-brand',
            belowMediaTextClass(),
          ].join(' ')}
        >
          {article.title}
        </h3>
      </Link>
    </article>
  )
}

const COMPACT_SIDE_THUMB_WIDTH_ENLARGED = Math.round(COMPACT_SIDE_THUMB_WIDTH * 1.2)
const HERO_CENTER_SCREEN_THUMB_SCALE = 1.3
const HERO_CENTER_SCREEN_THUMB_WIDTH = Math.round(
  COMPACT_SIDE_THUMB_WIDTH_ENLARGED * HERO_CENTER_SCREEN_THUMB_SCALE,
)
const HERO_CENTER_SCREEN_THUMB_HEIGHT = Math.round(
  COMPACT_SIDE_THUMB_HEIGHT * HERO_CENTER_SCREEN_THUMB_SCALE,
)

interface IHeroLayoutConfig {
  swapSideColumns?: boolean
  rightRailLeadAd?: boolean
  leftRailCount?: number
  stripCount?: number
  /** Compact side-thumb stories below the center hero (Global Headlines-style). */
  centerScreenNewsCount?: number
  /** Picture stories with headline below in the right rail (below optional lead ad). */
  rightScreenNewsCount?: number
  /** Static Tailwind class for lg column ratios (e.g. `lg:grid-cols-[4.8fr_3fr_3fr]`). */
  gridColsClass?: string
  /** Text-only headline links (no thumbnail) below left-rail picture stories. */
  leftRailTextLinkCount?: number
  /** Text-only headline links (no thumbnail) below right-rail picture stories. */
  rightRailTextLinkCount?: number
  /** Hide the last left-rail text link without shifting later hero slices. */
  hideLastLeftRailTextLink?: boolean
  /** Hide the last right-rail text link without shifting later hero slices. */
  hideLastRightRailTextLink?: boolean
  /** Normal-weight story headlines with underline on hover (World page). */
  plainStoryTitles?: boolean
}

interface IHeroBlockProps {
  articles: IArticle[]
  layout?: IHeroLayoutConfig
  plainStoryTitles?: boolean
}

function HeroBlock({ articles, layout, plainStoryTitles = false }: IHeroBlockProps): JSX.Element | null {
  const hero = articles[0]
  if (!hero) {
    return null
  }

  const {
    swapSideColumns = false,
    rightRailLeadAd = false,
    leftRailCount = 3,
    stripCount = 3,
    centerScreenNewsCount = 0,
    rightScreenNewsCount = 0,
    gridColsClass,
    leftRailTextLinkCount = 0,
    rightRailTextLinkCount = 0,
    hideLastLeftRailTextLink = false,
    hideLastRightRailTextLink = false,
  } = layout ?? {}

  const StoryCardComponent: ComponentType<IStoryCardProps> = plainStoryTitles
    ? HomepageStoryCard
    : StoryCard
  const heroTitleClass = plainStoryTitles
    ? 'text-3xl font-normal leading-tight text-neutral-950 group-hover:underline'
    : 'text-3xl font-black leading-tight text-neutral-950 group-hover:underline'

  const usesCenterScreenNews = centerScreenNewsCount > 0
  const usesLeftRailTextLinks = leftRailTextLinkCount > 0
  const usesRightRailTextLinks = rightRailTextLinkCount > 0

  let left: IArticle[]
  let leftTextLinks: IArticle[] = []
  let screenNews: IArticle[] = []
  let relatedLinks: IArticle[] = []
  let strip: IArticle[] = []
  let rightRailTextLinks: IArticle[] = []
  let rightScreenNews: IArticle[] = []
  let rightCards: IArticle[] = []

  if (usesCenterScreenNews) {
    let offset = 1
    left = articles.slice(offset, offset + leftRailCount).filter(Boolean) as IArticle[]
    offset += leftRailCount

    if (usesLeftRailTextLinks) {
      leftTextLinks = articles
        .slice(offset, offset + leftRailTextLinkCount)
        .filter(Boolean) as IArticle[]
      offset += leftRailTextLinkCount
    }

    screenNews = articles
      .slice(offset, offset + centerScreenNewsCount)
      .filter(Boolean) as IArticle[]
    offset += centerScreenNewsCount

    if (usesRightRailTextLinks) {
      rightRailTextLinks = articles
        .slice(offset, offset + rightRailTextLinkCount)
        .filter(Boolean) as IArticle[]
      offset += rightRailTextLinkCount
    }

    rightScreenNews = articles
      .slice(offset, offset + rightScreenNewsCount)
      .filter(Boolean) as IArticle[]
    offset += rightScreenNewsCount
    rightCards = articles.slice(offset, offset + 2).filter(Boolean) as IArticle[]
  } else {
    const defaultSlices = splitDefaultHeroArticles(articles)
    left = defaultSlices.left.slice(0, leftRailCount)
    relatedLinks = defaultSlices.relatedLinks
    strip = defaultSlices.strip.slice(0, stripCount)
    rightCards = defaultSlices.rightCards
  }
  const heroHref = `/article/${encodeURIComponent(hero.slug)}`
  const heroSummary = deckBelowTitle(hero.title, hero.summary, 220)

  const visibleLeftTextLinks = hideLastLeftRailTextLink ? leftTextLinks.slice(0, -1) : leftTextLinks
  const visibleRightRailTextLinks = hideLastRightRailTextLink
    ? rightRailTextLinks.slice(0, -1)
    : rightRailTextLinks

  const useFrColumns = gridColsClass !== undefined

  const leftColumn = (
    <div className={useFrColumns ? 'min-w-0 space-y-4' : 'min-w-0 space-y-4 lg:col-span-3'}>
      {left.map((article) => (
        <StoryCardComponent
          key={article.id}
          article={article}
          variant="rail"
          titleFirst={!usesCenterScreenNews}
          showSummary={!usesCenterScreenNews}
        />
      ))}
      {visibleLeftTextLinks.length > 0 ? (
        <ul className="divide-y divide-neutral-200 border-t border-neutral-200 pt-4">
          {visibleLeftTextLinks.map((article) => (
            <li key={article.id} className="py-3">
              <StoryCardComponent article={article} variant="text-link" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )

  const centerColumn = (
    <section className={useFrColumns ? 'min-w-0' : 'min-w-0 lg:col-span-6'}>
      <div>
        <Link href={heroHref} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]">
          {usesCenterScreenNews ? null : (
            <h2 className={heroTitleClass}>
              {hero.title}
            </h2>
          )}

          <div className={['overflow-hidden rounded border border-neutral-200 bg-neutral-100', usesCenterScreenNews ? '' : 'mt-4'].join(' ')}>
            <div className="relative aspect-[16/9]">
              <ArticleLeadMedia
                article={hero}
                mode="teaser"
                priority
                imageSizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>

          {usesCenterScreenNews ? (
            <h2 className={['mt-4', heroTitleClass].join(' ')}>
              {hero.title}
            </h2>
          ) : null}

          {heroSummary ? (
            <p className="mt-4 line-clamp-3 overflow-hidden text-sm leading-relaxed text-neutral-800">
              {heroSummary}
            </p>
          ) : null}
        </Link>

      {relatedLinks.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 pt-2">
          {relatedLinks.map((article) => (
            <StoryCardComponent key={article.id} article={article} variant="headline-only" />
          ))}
        </ul>
      ) : null}
    </div>

    {screenNews.length > 0 ? (
      <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4">
        {screenNews.map((article) => (
          <StoryCardComponent
            key={article.id}
            article={article}
            variant="compact"
            layout="side"
            sideThumbWidth={HERO_CENTER_SCREEN_THUMB_WIDTH}
            sideThumbHeight={HERO_CENTER_SCREEN_THUMB_HEIGHT}
          />
        ))}
      </div>
    ) : null}

    {strip.length > 0 ? (
      <div
        className={[
          'mt-4 grid grid-cols-1 gap-4',
          strip.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
        ].join(' ')}
      >
        {strip.map((article) => (
          <StoryCardComponent key={article.id} article={article} variant="compact" layout="stacked" />
        ))}
      </div>
    ) : null}
  </section>
  )

  const gridClass = useFrColumns
    ? `grid grid-cols-1 gap-6 ${gridColsClass}`
    : 'grid grid-cols-1 gap-6 lg:grid-cols-12'

  return (
    <div className={gridClass}>
      {swapSideColumns ? centerColumn : leftColumn}
      {swapSideColumns ? leftColumn : centerColumn}

      <aside className={useFrColumns ? 'min-w-0' : 'min-w-0 lg:col-span-3'}>
        <div className="space-y-4">
          {rightRailLeadAd ? <HeroRailAd /> : null}
          {rightScreenNews.map((article) => (
            <HeroPictureNewsScreen key={article.id} article={article} plainStoryTitles={plainStoryTitles} />
          ))}
          {visibleRightRailTextLinks.length > 0 ? (
            <ul className="divide-y divide-neutral-200 border-t border-neutral-200 pt-4">
              {visibleRightRailTextLinks.map((article) => (
                <li key={article.id} className="py-3">
                  <StoryCardComponent article={article} variant="text-link" />
                </li>
              ))}
            </ul>
          ) : null}
          {rightCards.slice(rightRailLeadAd ? 1 : 0).map((article, idx) => (
            <StoryCardComponent
              key={article.id}
              article={article}
              variant="rail"
              titleFirst={!usesCenterScreenNews && !rightRailLeadAd && idx === 0}
              showSummary={!usesCenterScreenNews && !rightRailLeadAd && idx === 0}
            />
          ))}
        </div>
      </aside>
    </div>
  )
}

const WORLD_COMPACT_BAND_PAIRS: readonly [string, string][] = [
  ['world-latest', 'world-regions'],
  ['world-middle-east', 'world-africa'],
]

function isSecondInWorldCompactBandPair(slot: IFeedSlot, previousSlot: IFeedSlot | undefined): boolean {
  if (!previousSlot) {
    return false
  }

  const key = normalizedPositionKey(slot)
  const previousKey = normalizedPositionKey(previousSlot)
  return WORLD_COMPACT_BAND_PAIRS.some(([first, second]) => first === previousKey && second === key)
}

function isLastInWorldCompactBandPair(slot: IFeedSlot): boolean {
  const key = normalizedPositionKey(slot)
  return WORLD_COMPACT_BAND_PAIRS.some(([, second]) => second === key)
}

function shouldShowGridAdBefore(slot: IFeedSlot, previousSlot: IFeedSlot | undefined): boolean {
  if (isSecondInWorldCompactBandPair(slot, previousSlot)) {
    return false
  }

  if (previousSlot && isLastInWorldCompactBandPair(previousSlot)) {
    return false
  }

  return true
}

function shouldShowGridAdAfter(slot: IFeedSlot): boolean {
  return isLastInWorldCompactBandPair(slot)
}

interface IEditorialLayoutConfig {
  hideLeadHeadlineLinks?: boolean
  showTrailingNewsScreen?: boolean
}

export interface ISectionPageConfig {
  pageName: string
  title: string
  hero?: IHeroLayoutConfig
  editorial?: IEditorialLayoutConfig
  plainStoryTitles?: boolean
}

interface ISectionPageProps {
  config: ISectionPageConfig
  initialFeed?: IHomepageFeed
}

/**
 * Dedicated section landing page (hero, editorial bands, and grid modules).
 */
export function SectionPage({
  config,
  initialFeed,
}: ISectionPageProps): JSX.Element {
  const {
    pageName,
    title,
    hero,
    editorial,
    plainStoryTitles = false,
  } = config
  const t = useTranslations('common')
  const { data, loading, error } = usePageFeed(pageName)
  const feedData = data ?? initialFeed

  if (loading && !feedData) return <div className="text-neutral-600">{t('loading')}</div>
  if (error && !feedData) return <div className="text-red-700">{t('failedToLoad', { message: error.message })}</div>

  const slots = feedData?.slots ?? []
  if (slots.length === 0) {
    return (
      <div className="text-neutral-600">
        {t.rich('noStoriesYet', {
          command: () => <code className="text-sm">{t('seedCommand')}</code>,
        })}
      </div>
    )
  }

  const heroSlot = findSlot(slots, PRESENTATION_HERO) ?? slots[0]
  const editorialBands = buildEditorialBands(slots)
  const usedSlotIds = editorialSlotIds(editorialBands)
  if (heroSlot) usedSlotIds.add(heroSlot.id)

  const gridSlots = slots.filter(
    (slot) => slot.presentationType === PRESENTATION_GRID_4 && !usedSlotIds.has(slot.id),
  )

  return (
    <div className="space-y-2">
      <header className="border-b border-neutral-200 pb-4">
        <p
          className={[
            'text-[11px] uppercase tracking-[0.28em] text-[color:var(--brand-red)]',
            plainStoryTitles ? 'font-normal' : 'font-black',
          ].join(' ')}
        >
          {t('section')}
        </p>
        <h1
          className={[
            'mt-1 text-4xl tracking-tight text-neutral-950',
            plainStoryTitles ? 'font-normal' : 'font-black',
          ].join(' ')}
        >
          {title}
        </h1>
      </header>

      <HeroBlock
        articles={heroSlot.articles}
        layout={hero}
        plainStoryTitles={plainStoryTitles}
      />
      <AdRibbon />

      {editorialBands.map((band, bandIndex) => (
        <div key={`${band.lead.id}-${band.spotlight.id}-${band.rail?.id ?? 'no-rail'}`} className="space-y-2">
          {bandIndex > 0 ? <AdRibbon /> : null}
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageEditorialBand
              moreTopStoriesSlot={band.lead}
              spotlightSlot={band.spotlight}
              rightRailSlot={band.rail}
              pageName={pageName}
              hideLeadHeadlineLinks={editorial?.hideLeadHeadlineLinks}
              showTrailingNewsScreen={editorial?.showTrailingNewsScreen}
            />
          </Suspense>
        </div>
      ))}

      {gridSlots.map((slot, index) => (
        <div key={slot.id} className="space-y-2">
          {shouldShowGridAdBefore(slot, gridSlots[index - 1]) ? <AdRibbon /> : null}
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageSection slot={slot} pageName={pageName} />
          </Suspense>
          {shouldShowGridAdAfter(slot) ? <AdRibbon /> : null}
        </div>
      ))}
    </div>
  )
}

export function WorldPage({ initialFeed }: { initialFeed?: IHomepageFeed }): JSX.Element {
  const { sectionLabel } = useSectionLabels()
  const config: ISectionPageConfig = {
    pageName: 'world',
    title: sectionLabel('world'),
    hero: {
      swapSideColumns: true,
      rightRailLeadAd: true,
      leftRailCount: 4,
      leftRailTextLinkCount: 5,
      hideLastLeftRailTextLink: true,
      centerScreenNewsCount: 8,
      rightScreenNewsCount: 2,
      rightRailTextLinkCount: 8,
      hideLastRightRailTextLink: true,
      gridColsClass: 'lg:grid-cols-[4.8fr_3fr_3fr]',
    },
    editorial: {
      hideLeadHeadlineLinks: true,
      showTrailingNewsScreen: true,
    },
    plainStoryTitles: true,
  }

  return (
    <SectionPage
      config={config}
      initialFeed={initialFeed}
    />
  )
}
