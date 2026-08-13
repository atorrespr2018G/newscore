'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSectionLabels } from '@/hooks/use-section-labels'
import type { IArticle } from '@/interfaces/article'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { PlacementOverlay, PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useFeed } from '@/hooks/use-feed'
import { usePageFeed } from '@/hooks/use-page-feed'
import {
  ArticleLeadMedia,
} from '@/components/ui/article-lead-media'
import { EditorialArticleLink } from '@/components/ui/editorial-article-link'
import {
  normalizedPositionKey,
  repairLegacyHomepageSlotOrder,
  resolveHomepagePageSlotKind,
  resolveSportsPageSlotKind,
  splitDefaultHeroArticles,
} from '@/lib/helpers/feed-layout'
import type { IEditorialBandSlots, HomepagePageSlotKind } from '@/lib/helpers/feed-layout'
import { shouldRenderHomepageGridAd } from '@/lib/helpers/homepage-ad-placement'
import { deckBelowTitle } from '@/lib/helpers/text-helpers'
import { AdSlot } from '@/components/ui/ad-slot'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { usePageAds, useSyncPageAdPlacements } from '@/context/page-ads-context'
import type { PageAdLocation } from '@/lib/helpers/page-ad-placements'
import { EmptyState, ErrorState, LoadingState, SectionSkeleton } from '@/components/ui/feed-state'
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

const HealthCarouselSection = dynamic(
  () =>
    import('@/components/features/homepage-health-carousel').then((m) => m.HealthCarouselSection),
  { loading: () => <SectionSkeleton /> },
)

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

/**
 * Homepage section ribbon backed by the shared AdSlot mock/GAM unit.
 *
 * Presence is owned by ribbon_ad section rows or leftover heuristics, not
 * the Advertisements panel.
 */
function AdRibbon({
  index = 0,
  location = 'before_section',
  anchorSlug,
}: {
  index?: number
  location?: PageAdLocation
  anchorSlug?: string | null
}): JSX.Element {
  const t = useTranslations('common')
  const { variantFor } = usePageAds()

  return (
    <section aria-label={t('advertisement')} className="py-4">
      <AdSlot
        slotKey="homepage-section-ribbon"
        index={index}
        variant={variantFor(location, 'ribbon', anchorSlug)}
      />
    </section>
  )
}

/**
 * Post-hero homepage ribbon.
 *
 * Shown only when the section list has no ribbon_ad rows.
 */
function HeroAdRibbon({ index = 0 }: { index?: number }): JSX.Element {
  const t = useTranslations('common')
  const { variantFor } = usePageAds()

  return (
    <section aria-label={t('advertisement')} className="py-4">
      <AdSlot
        slotKey="homepage-hero-after"
        index={index}
        variant={variantFor('after_hero', 'ribbon')}
      />
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
  const heroSummary = deckBelowTitle(hero.title, hero.summary, 200)
  return (
    <PlacementOverlay article={hero} editorDroppable>
      <EditorialArticleLink article={hero} className="group block" ariaLabel={hero.title}>
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
      </EditorialArticleLink>
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

const POLITICS_POSITION_KEY = 'politics'
const SPORTS_POSITION_KEY = 'sports'
const SPORTS_PAGE_NAME = 'sports'
const SPORTS_SECTION_PAIR_SIZE = 2
const LIVE_CAROUSEL_ARTICLE_LIMIT = 20

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

/**
 * Whether an ad ribbon should precede a main-page slot in the ordered walk.
 *
 * @param slot Current slot.
 * @param kind Resolved main-page slot kind.
 * @param previousSlot Previously rendered slot, if any.
 * @param previousKind Previous slot kind, if any.
 * @returns True when an AdRibbon should render before this slot.
 */
function shouldInsertHomepageAdBefore(
  slot: IFeedSlot,
  kind: HomepagePageSlotKind,
  previousSlot: IFeedSlot | null,
  previousKind: HomepagePageSlotKind | null,
): boolean {
  if (previousKind === null || kind === 'ribbon_ad') {
    return false
  }
  if (kind === 'live_carousel' || kind === 'editorial_lead') {
    return true
  }
  if (kind === 'compact_six') {
    if ((POST_POLITICS_AD_SECTION_KEYS as readonly string[]).includes(normalizedPositionKey(slot))) {
      return true
    }
    if (normalizedPositionKey(slot) === POLITICS_POSITION_KEY) {
      return true
    }
    return shouldRenderHomepageGridAd(previousSlot ?? undefined, slot)
  }
  return false
}

/**
 * Consume consecutive editorial lead + spotlight (+ optional rail) as one band.
 *
 * @param slots Remaining feed slots starting at the lead.
 * @returns Band and number of slots consumed, or null when not a band.
 */
function takeEditorialBand(slots: IFeedSlot[]): { band: IEditorialBandSlots; consumed: number } | null {
  const lead = slots[0]
  const spotlight = slots[1]
  if (!lead || !spotlight) {
    return null
  }
  if (resolveHomepagePageSlotKind(lead) !== 'editorial_lead') {
    return null
  }
  if (resolveHomepagePageSlotKind(spotlight) !== 'editorial_spotlight') {
    return null
  }
  const rail = slots[2]
  if (rail && resolveHomepagePageSlotKind(rail) === 'rail_compact') {
    return { band: { lead, spotlight, rail }, consumed: 3 }
  }
  return { band: { lead, spotlight }, consumed: 2 }
}

/**
 * Consume consecutive Politics + Sports category rows as the paired module.
 *
 * @param slots Remaining feed slots.
 * @returns Paired slots and count consumed, or null.
 */
function takePoliticsSportsPair(
  slots: IFeedSlot[],
): { politics: IFeedSlot; sports: IFeedSlot | undefined; consumed: number } | null {
  const first = slots[0]
  if (!first || normalizedPositionKey(first) !== POLITICS_POSITION_KEY) {
    return null
  }
  if (resolveHomepagePageSlotKind(first) !== 'compact_six') {
    return null
  }
  const second = slots[1]
  if (second && normalizedPositionKey(second) === SPORTS_POSITION_KEY) {
    return { politics: first, sports: second, consumed: 2 }
  }
  return { politics: first, sports: undefined, consumed: 1 }
}

function PoliticsSportsSection({
  politicsSlot,
  sportsSlot,
  adIndex,
  showAdRibbon = true,
}: {
  politicsSlot: IFeedSlot | undefined
  sportsSlot: IFeedSlot | undefined
  adIndex: number
  showAdRibbon?: boolean
}): JSX.Element | null {
  if (!politicsSlot && !sportsSlot) {
    return null
  }
  return (
    <div className="space-y-2">
      {politicsSlot ? (
        <>
          {showAdRibbon ? (
            <AdRibbon index={adIndex} location="before_section" anchorSlug="politics" />
          ) : null}
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

/**
 * Render one main-page slot by presentation kind.
 */
function HomepagePageSlotBlock({
  slot,
  kind,
  title,
  adIndex = 0,
}: {
  slot: IFeedSlot
  kind: HomepagePageSlotKind
  title: string
  adIndex?: number
}): JSX.Element | null {
  if (kind === 'ribbon_ad') {
    return <AdRibbon index={adIndex} />
  }
  if (kind === 'hero') {
    return (
      <PlacementSlotScope slotId={slot.id}>
        <HeroBlock articles={slot.articles} />
      </PlacementSlotScope>
    )
  }
  if (kind === 'featured_band') {
    return <EarlyUsSection slot={slot} title={title} />
  }
  if (kind === 'live_carousel') {
    return (
      <Suspense fallback={<SectionSkeleton />}>
        <HealthCarouselSection
          slot={{ ...slot, articles: slot.articles.slice(0, LIVE_CAROUSEL_ARTICLE_LIMIT) }}
        />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <HomepageSection slot={slot} />
    </Suspense>
  )
}

/**
 * Main Page stack: render layout slots in configured order with ad-ribbon heuristics.
 */
/**
 * Whether the feed already includes configuration-driven ribbon advertisement slots.
 *
 * @param slots Ordered feed slots.
 * @returns True when heuristic ribbons should be suppressed.
 */
function feedHasConfiguredRibbonAds(slots: IFeedSlot[]): boolean {
  return slots.some((slot) => resolveHomepagePageSlotKind(slot) === 'ribbon_ad')
}

function MainPageOrderedSections({
  slots,
  sectionLabel,
  pageName,
}: {
  slots: IFeedSlot[]
  sectionLabel: (positionKey: string) => string
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
}): JSX.Element {
  const orderedSlots = repairLegacyHomepageSlotOrder(slots)
  const useConfiguredRibbons = feedHasConfiguredRibbonAds(orderedSlots)
  const blocks: JSX.Element[] = []
  let index = 0
  let adIndex = 0
  let previousSlot: IFeedSlot | null = null
  let previousKind: HomepagePageSlotKind | null = null

  while (index < orderedSlots.length) {
    const remaining = orderedSlots.slice(index)
    const bandTaken = takeEditorialBand(remaining)
    if (bandTaken) {
      const bandAdIndex =
        !useConfiguredRibbons && previousKind !== null ? adIndex++ : null
      blocks.push(
        <div key={`${bandTaken.band.lead.id}-band`} className="space-y-2">
          {bandAdIndex !== null ? (
            <AdRibbon
              index={bandAdIndex}
              location="before_section"
              anchorSlug={normalizedPositionKey(bandTaken.band.lead)}
            />
          ) : null}
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageEditorialBand
              moreTopStoriesSlot={bandTaken.band.lead}
              spotlightSlot={bandTaken.band.spotlight}
              rightRailSlot={bandTaken.band.rail}
              pageName={pageName}
            />
          </Suspense>
        </div>,
      )
      previousSlot = bandTaken.band.rail ?? bandTaken.band.spotlight
      previousKind = 'editorial_lead'
      index += bandTaken.consumed
      continue
    }

    const pairTaken = takePoliticsSportsPair(remaining)
    if (pairTaken) {
      const pairAdIndex = adIndex
      if (!useConfiguredRibbons && pairTaken.politics) {
        adIndex += 1
      }
      blocks.push(
        <PoliticsSportsSection
          key={`${pairTaken.politics.id}-politics-sports`}
          politicsSlot={pairTaken.politics}
          sportsSlot={pairTaken.sports}
          adIndex={pairAdIndex}
          showAdRibbon={!useConfiguredRibbons}
        />,
      )
      previousSlot = pairTaken.sports ?? pairTaken.politics
      previousKind = 'compact_six'
      index += pairTaken.consumed
      continue
    }

    const slot = orderedSlots[index]
    const kind = resolveHomepagePageSlotKind(slot)
    const title = slot.displayName?.trim() || sectionLabel(slot.positionKey)
    if (kind === 'ribbon_ad') {
      const ribbonIndex = adIndex++
      blocks.push(
        <div key={slot.id} className="space-y-2">
          <HomepagePageSlotBlock slot={slot} kind={kind} title={title} adIndex={ribbonIndex} />
        </div>,
      )
      previousSlot = slot
      previousKind = kind
      index += 1
      continue
    }
    const showAdBefore =
      !useConfiguredRibbons &&
      shouldInsertHomepageAdBefore(slot, kind, previousSlot, previousKind)
    const beforeAdIndex = showAdBefore ? adIndex++ : null
    const heroAdIndex = !useConfiguredRibbons && kind === 'hero' ? adIndex++ : null
    blocks.push(
      <div key={slot.id} className="space-y-2">
        {beforeAdIndex !== null ? (
          <AdRibbon
            index={beforeAdIndex}
            location="before_section"
            anchorSlug={normalizedPositionKey(slot)}
          />
        ) : null}
        <HomepagePageSlotBlock slot={slot} kind={kind} title={title} />
        {heroAdIndex !== null ? <HeroAdRibbon index={heroAdIndex} /> : null}
      </div>,
    )
    previousSlot = slot
    previousKind = kind
    index += 1
  }

  return <>{blocks}</>
}

interface IHomepageContentOptions {
  /** Sports page: render dynamic sport rows (two sections, then an ad ribbon). */
  useSportsSectionRows?: boolean
}

/**
 * Whether an ad ribbon should precede a sports page slot.
 *
 * @param kind Resolved sports slot kind.
 * @param previousKind Kind of the previous slot, if any.
 * @param compactIndex Zero-based index among compact sport rows so far.
 * @returns True when an AdRibbon should render before this slot.
 */
function shouldInsertSportsAdBefore(
  kind: ReturnType<typeof resolveSportsPageSlotKind>,
  previousKind: ReturnType<typeof resolveSportsPageSlotKind> | null,
  compactIndex: number,
): boolean {
  if (kind === 'ribbon_ad') {
    return false
  }
  if (kind === 'live_carousel') {
    return true
  }
  if (kind === 'featured_band' && previousKind !== null && previousKind !== 'hero') {
    return true
  }
  if (kind === 'compact_six' && compactIndex > 0 && compactIndex % SPORTS_SECTION_PAIR_SIZE === 0) {
    return true
  }
  return false
}

/**
 * Render one sports page slot by presentation kind.
 */
function SportsPageSlotBlock({
  slot,
  kind,
  title,
  adIndex = 0,
}: {
  slot: IFeedSlot
  kind: ReturnType<typeof resolveSportsPageSlotKind>
  title: string
  adIndex?: number
}): JSX.Element | null {
  if (kind === 'ribbon_ad') {
    return <AdRibbon index={adIndex} />
  }
  if (kind === 'hero') {
    return (
      <PlacementSlotScope slotId={slot.id}>
        <HeroBlock articles={slot.articles} />
      </PlacementSlotScope>
    )
  }
  if (kind === 'featured_band') {
    return (
      <Suspense fallback={<SectionSkeleton />}>
        <HomepageUsBand slot={slot} title={title} />
      </Suspense>
    )
  }
  if (kind === 'live_carousel') {
    return (
      <Suspense fallback={<SectionSkeleton />}>
        <HealthCarouselSection
          slot={{ ...slot, articles: slot.articles.slice(0, LIVE_CAROUSEL_ARTICLE_LIMIT) }}
        />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <HomepageSection slot={slot} pageName={SPORTS_PAGE_NAME} />
    </Suspense>
  )
}

/**
 * Sports page stack: render layout slots in order with light ad-ribbon heuristics.
 */
function SportsPageSections({
  slots,
  sectionLabel,
}: {
  slots: IFeedSlot[]
  sectionLabel: (positionKey: string) => string
}): JSX.Element {
  const useConfiguredRibbons = slots.some(
    (slot) => resolveSportsPageSlotKind(slot) === 'ribbon_ad',
  )
  const blocks: JSX.Element[] = []
  let compactIndex = 0
  let adIndex = 0
  let previousKind: ReturnType<typeof resolveSportsPageSlotKind> | null = null

  for (const slot of slots) {
    const kind = resolveSportsPageSlotKind(slot)
    const title = slot.displayName?.trim() || sectionLabel(slot.positionKey)
    if (kind === 'ribbon_ad') {
      const ribbonIndex = adIndex++
      blocks.push(
        <div key={slot.id} className="space-y-2">
          <SportsPageSlotBlock slot={slot} kind={kind} title={title} adIndex={ribbonIndex} />
        </div>,
      )
      previousKind = kind
      continue
    }
    const showAdBefore =
      !useConfiguredRibbons && shouldInsertSportsAdBefore(kind, previousKind, compactIndex)
    const beforeAdIndex = showAdBefore ? adIndex++ : null
    const heroAdIndex = !useConfiguredRibbons && kind === 'hero' ? adIndex++ : null
    blocks.push(
      <div key={slot.id} className="space-y-2">
        {beforeAdIndex !== null ? (
          <AdRibbon
            index={beforeAdIndex}
            location="before_section"
            anchorSlug={normalizedPositionKey(slot)}
          />
        ) : null}
        <SportsPageSlotBlock slot={slot} kind={kind} title={title} />
        {heroAdIndex !== null ? <HeroAdRibbon index={heroAdIndex} /> : null}
      </div>,
    )
    if (kind === 'compact_six') {
      compactIndex += 1
    }
    previousKind = kind
  }

  return <>{blocks}</>
}

interface IHomepageContentProps {
  feed: IHomepageFeed
  options?: IHomepageContentOptions
}

/**
 * Render the homepage module stack from a resolved feed.
 *
 * @param feed Homepage feed with slots and articles.
 * @param options Optional render flags for page variants.
 * @returns Homepage content without data fetching.
 */
export function HomepageContent({ feed, options }: IHomepageContentProps): JSX.Element {
  const pageName = feed.pageName.trim().toLowerCase()
  const { sectionLabel } = useSectionLabels(pageName)
  useSyncPageAdPlacements(feed.adPlacements)
  const slots = feed.slots ?? []
  if (slots.length === 0) {
    return (
      <div className="text-neutral-600">
        No homepage slots configured.
      </div>
    )
  }

  const useSportsSectionRows =
    options?.useSportsSectionRows === true || pageName === SPORTS_PAGE_NAME

  if (useSportsSectionRows) {
    return (
      <div className="space-y-2 [&_a:hover]:text-neutral-950 [&_a:hover]:underline [&_button:hover]:text-neutral-950 [&_button:hover]:underline">
        <SportsPageSections slots={slots} sectionLabel={sectionLabel} />
      </div>
    )
  }

  return (
    <div className="space-y-2 [&_a:hover]:text-neutral-950 [&_a:hover]:underline [&_button:hover]:text-neutral-950 [&_button:hover]:underline">
      <MainPageOrderedSections
        slots={slots}
        sectionLabel={sectionLabel}
        pageName={pageName}
      />
    </div>
  )
}

/**
 * Shared loading / error / empty handling for homepage-format pages.
 */
function HomepageFeedShell({
  feedData,
  loading,
  error,
  children,
}: {
  feedData: IHomepageFeed | undefined
  loading: boolean
  error: Error | undefined
  children: (feed: IHomepageFeed) => JSX.Element
}): JSX.Element {
  const t = useTranslations('common')

  if (loading && !feedData) return <LoadingState message={t('loading')} />
  if (error && !feedData) return <ErrorState message={t('failedToLoad', { message: error.message })} />

  if (!feedData || feedData.slots.length === 0) {
    return (
      <EmptyState>
        {t.rich('noStoriesYet', {
          command: () => <code className="text-sm">{t('seedCommand')}</code>,
        })}
      </EmptyState>
    )
  }

  return children(feedData)
}

/**
 * Render the homepage module stack from the active feed.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Homepage component.
 */
export function Homepage({ initialFeed }: { initialFeed?: IHomepageFeed }): JSX.Element {
  const { data, loading, error } = useFeed()
  const feedData = data ?? initialFeed

  return (
    <HomepageFeedShell feedData={feedData} loading={loading} error={error ?? undefined}>
      {(feed) => <HomepageContent feed={feed} />}
    </HomepageFeedShell>
  )
}

/**
 * Sports page using the landing-page hero/Top Stories plus dynamic sport rows.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Sports page component.
 */
export function SportsPage({ initialFeed }: { initialFeed?: IHomepageFeed }): JSX.Element {
  const { data, loading, error } = usePageFeed('sports')
  const feedData = data ?? initialFeed

  return (
    <HomepageFeedShell feedData={feedData} loading={loading} error={error ?? undefined}>
      {(feed) => <HomepageContent feed={feed} options={{ useSportsSectionRows: true }} />}
    </HomepageFeedShell>
  )
}
