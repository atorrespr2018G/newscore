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
  splitSectionHeroArticles,
} from '@/lib/helpers/feed-layout'
import { belowMediaTextClass, deckBelowTitle } from '@/lib/helpers/text-helpers'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { EmptyState, ErrorState, LoadingState, SectionSkeleton } from '@/components/ui/feed-state'
import {
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
  largeTitle = false,
}: {
  article: IArticle
  plainStoryTitles?: boolean
  /** Match the hero headline size (first column only). */
  largeTitle?: boolean
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
              ? largeTitle
                ? 'mt-2 overflow-hidden text-3xl font-normal leading-tight text-neutral-950 group-hover:underline'
                : 'mt-2 overflow-hidden text-[15px] font-normal leading-snug text-neutral-950 group-hover:underline'
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
  /** Picture-card count appended to the right rail (defaults to 2). */
  rightCardCount?: number
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

interface IResolvedHeroLayout {
  swapSideColumns: boolean
  rightRailLeadAd: boolean
  leftRailCount: number
  stripCount: number
  centerScreenNewsCount: number
  rightScreenNewsCount: number
  gridColsClass: string | undefined
  leftRailTextLinkCount: number
  rightRailTextLinkCount: number
  rightCardCount: number
  hideLastLeftRailTextLink: boolean
  hideLastRightRailTextLink: boolean
}

const HERO_DEFAULT_LEFT_RAIL_COUNT = 3
const HERO_DEFAULT_STRIP_COUNT = 3

function resolveHeroLayoutConfig(layout?: IHeroLayoutConfig): IResolvedHeroLayout {
  return {
    swapSideColumns: layout?.swapSideColumns ?? false,
    rightRailLeadAd: layout?.rightRailLeadAd ?? false,
    leftRailCount: layout?.leftRailCount ?? HERO_DEFAULT_LEFT_RAIL_COUNT,
    stripCount: layout?.stripCount ?? HERO_DEFAULT_STRIP_COUNT,
    centerScreenNewsCount: layout?.centerScreenNewsCount ?? 0,
    rightScreenNewsCount: layout?.rightScreenNewsCount ?? 0,
    gridColsClass: layout?.gridColsClass,
    leftRailTextLinkCount: layout?.leftRailTextLinkCount ?? 0,
    rightRailTextLinkCount: layout?.rightRailTextLinkCount ?? 0,
    rightCardCount: layout?.rightCardCount ?? 2,
    hideLastLeftRailTextLink: layout?.hideLastLeftRailTextLink ?? false,
    hideLastRightRailTextLink: layout?.hideLastRightRailTextLink ?? false,
  }
}

function heroTitleClassName(plainStoryTitles: boolean): string {
  return plainStoryTitles
    ? 'text-3xl font-normal leading-tight text-neutral-950 group-hover:underline'
    : 'text-3xl font-black leading-tight text-neutral-950 group-hover:underline'
}

interface IHeroColumnContext {
  StoryCardComponent: ComponentType<IStoryCardProps>
  usesCenterScreenNews: boolean
  useFrColumns: boolean
}

function HeroLeftColumn({
  context,
  left,
  leftTextLinks,
  plainStoryTitles = false,
}: {
  context: IHeroColumnContext
  left: IArticle[]
  leftTextLinks: IArticle[]
  plainStoryTitles?: boolean
}): JSX.Element {
  const { StoryCardComponent, usesCenterScreenNews, useFrColumns } = context

  return (
    <div className={useFrColumns ? 'min-w-0 space-y-4' : 'min-w-0 space-y-4 lg:col-span-3'}>
      {usesCenterScreenNews
        ? left.map((article) => (
            <HeroPictureNewsScreen key={article.id} article={article} plainStoryTitles={plainStoryTitles} />
          ))
        : left.map((article) => (
            <StoryCardComponent
              key={article.id}
              article={article}
              variant="rail"
              titleFirst
              showSummary
            />
          ))}
      {leftTextLinks.length > 0 ? (
        <ul className="divide-y divide-neutral-200 border-t border-neutral-200 pt-4">
          {leftTextLinks.map((article) => (
            <li key={article.id} className="py-3">
              <StoryCardComponent article={article} variant="text-link" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

interface IHeroCenterColumnProps {
  context: IHeroColumnContext
  hero: IArticle
  heroTitleClass: string
  heroSummary: string | null
  relatedLinks: IArticle[]
  screenNews: IArticle[]
  strip: IArticle[]
  plainStoryTitles?: boolean
}

function HeroCenterColumn({
  context,
  hero,
  heroTitleClass,
  heroSummary,
  relatedLinks,
  screenNews,
  strip,
  plainStoryTitles = false,
}: IHeroCenterColumnProps): JSX.Element {
  const { StoryCardComponent, usesCenterScreenNews, useFrColumns } = context
  const heroHref = `/article/${encodeURIComponent(hero.slug)}`

  return (
    <section className={useFrColumns ? 'min-w-0' : 'min-w-0 lg:col-span-6'}>
      <div>
        <Link href={heroHref} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]">
          {usesCenterScreenNews ? null : <h2 className={heroTitleClass}>{hero.title}</h2>}

          <div className={['overflow-hidden rounded border border-neutral-200 bg-neutral-100', usesCenterScreenNews ? '' : 'mt-4'].join(' ')}>
            <div className="relative aspect-[16/9]">
              <ArticleLeadMedia article={hero} mode="teaser" priority imageSizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
          </div>

          {usesCenterScreenNews ? <h2 className={['mt-4', heroTitleClass].join(' ')}>{hero.title}</h2> : null}

          {heroSummary ? (
            <p className="mt-4 line-clamp-3 overflow-hidden text-sm leading-relaxed text-neutral-800">{heroSummary}</p>
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
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-neutral-200 pt-4">
          {screenNews.map((article) => (
            <HeroPictureNewsScreen key={article.id} article={article} plainStoryTitles={plainStoryTitles} largeTitle={plainStoryTitles} />
          ))}
        </div>
      ) : null}

      {strip.length > 0 ? (
        <div className={['mt-4 grid grid-cols-1 gap-4', strip.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'].join(' ')}>
          {strip.map((article) => (
            <StoryCardComponent key={article.id} article={article} variant="compact" layout="stacked" />
          ))}
        </div>
      ) : null}
    </section>
  )
}

interface IHeroRightColumnProps {
  context: IHeroColumnContext
  rightRailLeadAd: boolean
  plainStoryTitles: boolean
  rightScreenNews: IArticle[]
  rightRailTextLinks: IArticle[]
  rightCards: IArticle[]
}

function HeroRightColumn({
  context,
  rightRailLeadAd,
  plainStoryTitles,
  rightScreenNews,
  rightRailTextLinks,
  rightCards,
}: IHeroRightColumnProps): JSX.Element {
  const { StoryCardComponent, usesCenterScreenNews, useFrColumns } = context

  return (
    <aside className={useFrColumns ? 'min-w-0' : 'min-w-0 lg:col-span-3'}>
      <div className="space-y-4">
        {rightRailLeadAd ? (
          <>
            <HeroRailAd />
            <HeroRailAd />
            <HeroRailAd />
          </>
        ) : null}
        {rightScreenNews.map((article) => (
          <HeroPictureNewsScreen key={article.id} article={article} plainStoryTitles={plainStoryTitles} />
        ))}
        {rightRailTextLinks.length > 0 ? (
          <ul className="divide-y divide-neutral-200 border-t border-neutral-200 pt-4">
            {rightRailTextLinks.map((article) => (
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
  )
}

function HeroBlock({ articles, layout, plainStoryTitles = false }: IHeroBlockProps): JSX.Element | null {
  const hero = articles[0]
  if (!hero) {
    return null
  }

  const cfg = resolveHeroLayoutConfig(layout)
  const slices = splitSectionHeroArticles(articles, cfg)
  const context: IHeroColumnContext = {
    StoryCardComponent: plainStoryTitles ? HomepageStoryCard : StoryCard,
    usesCenterScreenNews: cfg.centerScreenNewsCount > 0,
    useFrColumns: cfg.gridColsClass !== undefined,
  }
  const heroSummary = deckBelowTitle(hero.title, hero.summary, 220)
  const visibleLeftTextLinks = cfg.hideLastLeftRailTextLink ? slices.leftTextLinks.slice(0, -1) : slices.leftTextLinks
  const visibleRightRailTextLinks = cfg.hideLastRightRailTextLink
    ? slices.rightRailTextLinks.slice(0, -1)
    : slices.rightRailTextLinks

  const leftColumn = <HeroLeftColumn context={context} left={slices.left} leftTextLinks={visibleLeftTextLinks} plainStoryTitles={plainStoryTitles} />
  const centerColumn = (
    <HeroCenterColumn
      context={context}
      hero={hero}
      heroTitleClass={heroTitleClassName(plainStoryTitles)}
      heroSummary={heroSummary}
      relatedLinks={slices.relatedLinks}
      screenNews={slices.screenNews}
      strip={slices.strip}
      plainStoryTitles={plainStoryTitles}
    />
  )
  const gridClass = context.useFrColumns
    ? `grid grid-cols-1 gap-6 ${cfg.gridColsClass}`
    : 'grid grid-cols-1 gap-6 lg:grid-cols-12'

  return (
    <div className={gridClass}>
      {cfg.swapSideColumns ? centerColumn : leftColumn}
      {cfg.swapSideColumns ? leftColumn : centerColumn}
      <HeroRightColumn
        context={context}
        rightRailLeadAd={cfg.rightRailLeadAd}
        plainStoryTitles={plainStoryTitles}
        rightScreenNews={slices.rightScreenNews}
        rightRailTextLinks={visibleRightRailTextLinks}
        rightCards={slices.rightCards}
      />
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

  if (loading && !feedData) return <LoadingState message={t('loading')} />
  if (error && !feedData) return <ErrorState message={t('failedToLoad', { message: error.message })} />

  const slots = feedData?.slots ?? []
  if (slots.length === 0) {
    return (
      <EmptyState>
        {t.rich('noStoriesYet', {
          command: () => <code className="text-sm">{t('seedCommand')}</code>,
        })}
      </EmptyState>
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

/** Politics section page with the same layout style as World. */
export function PoliticsPage({ initialFeed }: { initialFeed?: IHomepageFeed }): JSX.Element {
  const { sectionLabel } = useSectionLabels()
  const config: ISectionPageConfig = {
    pageName: 'politics',
    title: sectionLabel('politics'),
    hero: {
      swapSideColumns: true,
      rightRailLeadAd: true,
      leftRailCount: 6,
      leftRailTextLinkCount: 0,
      hideLastLeftRailTextLink: false,
      centerScreenNewsCount: 4,
      rightScreenNewsCount: 1,
      rightRailTextLinkCount: 6,
      rightCardCount: 1,
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

export function WorldPage({ initialFeed }: { initialFeed?: IHomepageFeed }): JSX.Element {
  const { sectionLabel } = useSectionLabels()
  const config: ISectionPageConfig = {
    pageName: 'world',
    title: sectionLabel('world'),
    hero: {
      swapSideColumns: true,
      rightRailLeadAd: true,
      leftRailCount: 6,
      leftRailTextLinkCount: 0,
      hideLastLeftRailTextLink: false,
      centerScreenNewsCount: 3,
      rightScreenNewsCount: 1,
      rightRailTextLinkCount: 6,
      rightCardCount: 1,
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
