'use client'

import { Suspense } from 'react'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { useMarket } from '@/context/market-context'
import { HeroBlock } from '@/components/features/homepage-hero'
import { HeroAdRibbon, MainPageAdRibbon } from '@/components/features/homepage-ads'
import {
  HealthCarouselSection,
  HomepageEditorialBand,
  HomepageSection,
  HomepageUsBand,
} from '@/components/features/homepage-dynamic-sections'
import { SectionSkeleton } from '@/components/ui/feed-state'
import { HOMEPAGE_PAGE_NAME, LIVE_CAROUSEL_ARTICLE_LIMIT } from '@/lib/helpers/homepage-page-names'
import {
  ELECTION_POSITION_KEY,
  feedHasConfiguredPostHeroRibbonAd,
  feedHasConfiguredRibbonAds,
  shouldInsertHomepageAdBefore,
  takeEditorialBand,
  takePoliticsSectionCluster,
} from '@/lib/helpers/homepage-slot-walk'
import {
  normalizedPositionKey,
  repairLegacyHomepageSlotOrder,
  resolveHomepagePageSlotKind,
} from '@/lib/helpers/feed-layout'
import type { HomepagePageSlotKind } from '@/lib/helpers/feed-layout'
import { shouldOmitUsaHomepageSection } from '@/lib/helpers/section-labels'
import type { IFeedSlot } from '@/interfaces/feed'

interface IMainPageOrderedSectionsProps {
  slots: IFeedSlot[]
  sectionLabel: (positionKey: string) => string
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
}

/**
 * Early US / featured band wrapper.
 *
 * @param props Featured-band slot and optional title override.
 * @returns The US band, or null when the slot is missing.
 */
function EarlyUsSection({
  slot,
  title,
  pageName,
}: {
  slot: IFeedSlot | undefined
  title: string
  pageName?: string
}): JSX.Element | null {
  if (!slot) {
    return null
  }
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <HomepageUsBand slot={slot} title={title} pageName={pageName} />
    </Suspense>
  )
}

/**
 * Politics compact row plus the following Sports row.
 *
 * @param props Politics/sports slots and optional heuristic ribbon.
 * @returns The paired section block, or null when both slots are missing.
 */
function PoliticsClusterSection({
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
            <MainPageAdRibbon index={adIndex} location="before_section" anchorSlug="politics" />
          ) : null}
          <Suspense fallback={<SectionSkeleton />}>
            <HomepageSection slot={politicsSlot} pageName={HOMEPAGE_PAGE_NAME} />
          </Suspense>
        </>
      ) : null}
      {sportsSlot ? (
        <Suspense fallback={<SectionSkeleton />}>
          <HomepageSection slot={sportsSlot} pageName={HOMEPAGE_PAGE_NAME} />
        </Suspense>
      ) : null}
    </div>
  )
}

/**
 * Render one main-page slot by presentation kind.
 *
 * @param props Slot, resolved kind, and page context.
 * @returns The slot module, or an ad ribbon for ribbon_ad rows.
 */
function HomepagePageSlotBlock({
  slot,
  kind,
  title,
  adIndex = 0,
  pageName,
}: {
  slot: IFeedSlot
  kind: HomepagePageSlotKind
  title: string
  adIndex?: number
  pageName?: string
}): JSX.Element | null {
  if (kind === 'ribbon_ad') {
    return <MainPageAdRibbon index={adIndex} />
  }
  if (kind === 'hero') {
    return (
      <PlacementSlotScope slotId={slot.id}>
        <HeroBlock
          articles={slot.articles}
          enableVideoAd={pageName === HOMEPAGE_PAGE_NAME}
        />
      </PlacementSlotScope>
    )
  }
  if (kind === 'featured_band') {
    return <EarlyUsSection slot={slot} title={title} pageName={pageName} />
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
      <HomepageSection slot={slot} pageName={pageName} />
    </Suspense>
  )
}

/**
 * Editorial lead + spotlight (+ rail) band with an optional preceding ribbon.
 *
 * @param props Taken band, ribbon index, and page name.
 * @returns The editorial band block.
 */
function EditorialBandBlock({
  bandTaken,
  bandAdIndex,
  pageName,
}: {
  bandTaken: NonNullable<ReturnType<typeof takeEditorialBand>>
  bandAdIndex: number | null
  pageName?: string
}): JSX.Element {
  return (
    <div className="space-y-2">
      {bandAdIndex !== null ? (
        <MainPageAdRibbon
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
    </div>
  )
}

/**
 * Single main-page slot with optional before/after heuristic ribbons.
 *
 * @param props Slot, kind, and ribbon indexes.
 * @returns The slot block.
 */
function MainPageSlotWithAds({
  slot,
  kind,
  title,
  pageName,
  beforeAdIndex,
  heroAdIndex,
}: {
  slot: IFeedSlot
  kind: HomepagePageSlotKind
  title: string
  pageName?: string
  beforeAdIndex: number | null
  heroAdIndex: number | null
}): JSX.Element {
  return (
    <div className="space-y-2">
      {beforeAdIndex !== null ? (
        <MainPageAdRibbon
          index={beforeAdIndex}
          location="before_section"
          anchorSlug={normalizedPositionKey(slot)}
        />
      ) : null}
      <HomepagePageSlotBlock slot={slot} kind={kind} title={title} pageName={pageName} />
      {heroAdIndex !== null ? <HeroAdRibbon index={heroAdIndex} enlargeFirst /> : null}
    </div>
  )
}

/**
 * Main Page stack: render layout slots in configured order with ad-ribbon heuristics.
 *
 * @param props Ordered slots, section labels, and optional page name.
 * @returns The homepage module stack.
 */
export function MainPageOrderedSections({
  slots,
  sectionLabel,
  pageName,
}: IMainPageOrderedSectionsProps): JSX.Element {
  const { marketCode } = useMarket()
  const orderedSlots = repairLegacyHomepageSlotOrder(slots)
  const useConfiguredRibbons = feedHasConfiguredRibbonAds(orderedSlots)
  const useConfiguredPostHeroRibbon = feedHasConfiguredPostHeroRibbonAd(orderedSlots)
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
        <EditorialBandBlock
          key={`${bandTaken.band.lead.id}-band`}
          bandTaken={bandTaken}
          bandAdIndex={bandAdIndex}
          pageName={pageName}
        />,
      )
      previousSlot = bandTaken.band.rail ?? bandTaken.band.spotlight
      previousKind = 'editorial_lead'
      index += bandTaken.consumed
      continue
    }

    const clusterTaken = takePoliticsSectionCluster(remaining)
    if (clusterTaken) {
      const clusterAdIndex = adIndex
      if (!useConfiguredRibbons && clusterTaken.politics) {
        adIndex += 1
      }
      blocks.push(
        <PoliticsClusterSection
          key={`${clusterTaken.politics.id}-politics-cluster`}
          politicsSlot={clusterTaken.politics}
          sportsSlot={clusterTaken.sports}
          adIndex={clusterAdIndex}
          showAdRibbon={!useConfiguredRibbons}
        />,
      )
      previousSlot = clusterTaken.sports ?? clusterTaken.politics
      previousKind = 'compact_six'
      index += clusterTaken.consumed
      continue
    }

    const slot = orderedSlots[index]
    if (normalizedPositionKey(slot) === ELECTION_POSITION_KEY) {
      index += 1
      continue
    }
    if (shouldOmitUsaHomepageSection(marketCode, pageName, normalizedPositionKey(slot))) {
      index += 1
      continue
    }
    const kind = resolveHomepagePageSlotKind(slot)
    const title = slot.displayName?.trim() || sectionLabel(slot.positionKey)
    if (kind === 'ribbon_ad') {
      const ribbonIndex = adIndex++
      blocks.push(
        <div key={slot.id} className="space-y-2">
          <HomepagePageSlotBlock
            slot={slot}
            kind={kind}
            title={title}
            adIndex={ribbonIndex}
            pageName={pageName}
          />
        </div>,
      )
      previousSlot = slot
      previousKind = kind
      index += 1
      continue
    }
    const showAdBefore =
      !useConfiguredRibbons &&
      shouldInsertHomepageAdBefore({ slot, kind, previousSlot, previousKind })
    const beforeAdIndex = showAdBefore ? adIndex++ : null
    const heroAdIndex = !useConfiguredPostHeroRibbon && kind === 'hero' ? adIndex++ : null
    blocks.push(
      <MainPageSlotWithAds
        key={slot.id}
        slot={slot}
        kind={kind}
        title={title}
        pageName={pageName}
        beforeAdIndex={beforeAdIndex}
        heroAdIndex={heroAdIndex}
      />,
    )
    previousSlot = slot
    previousKind = kind
    index += 1
  }

  return <>{blocks}</>
}
