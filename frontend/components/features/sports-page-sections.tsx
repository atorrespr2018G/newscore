'use client'

import { Suspense } from 'react'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { HeroBlock } from '@/components/features/homepage-hero'
import { AdRibbon, HeroAdRibbon } from '@/components/features/homepage-ads'
import {
  HealthCarouselSection,
  HomepageSection,
  HomepageUsBand,
} from '@/components/features/homepage-dynamic-sections'
import { SectionSkeleton } from '@/components/ui/feed-state'
import { LIVE_CAROUSEL_ARTICLE_LIMIT } from '@/lib/helpers/homepage-page-names'
import { shouldInsertSportsAdBefore } from '@/lib/helpers/sports-page-slot-walk'
import { normalizedPositionKey, resolveSportsPageSlotKind } from '@/lib/helpers/feed-layout'
import type { SportsPageSlotKind } from '@/lib/helpers/feed-layout'
import type { IFeedSlot } from '@/interfaces/feed'

interface ISportsPageSectionsProps {
  slots: IFeedSlot[]
  sectionLabel: (positionKey: string) => string
  pageName: string
}

/**
 * Render one sports-style page slot by presentation kind.
 *
 * @param props Slot, resolved kind, and page context.
 * @returns The slot module, or null for archive rows.
 */
function SportsPageSlotBlock({
  slot,
  kind,
  title,
  pageName,
  adIndex = 0,
}: {
  slot: IFeedSlot
  kind: SportsPageSlotKind
  title: string
  pageName: string
  adIndex?: number
}): JSX.Element | null {
  if (kind === 'ribbon_ad') {
    return <AdRibbon index={adIndex} />
  }
  if (kind === 'section_archive') {
    return null
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
        <HomepageUsBand slot={slot} title={title} pageName={pageName} />
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
      <HomepageSection slot={slot} pageName={pageName} />
    </Suspense>
  )
}

/**
 * Sports-style stack: layout slots in order with light ad-ribbon heuristics.
 *
 * @param props Ordered slots, section labels, and page name.
 * @returns The sports-style module stack.
 */
export function SportsPageSections({
  slots,
  sectionLabel,
  pageName,
}: ISportsPageSectionsProps): JSX.Element {
  const useConfiguredRibbons = slots.some(
    (slot) => resolveSportsPageSlotKind(slot) === 'ribbon_ad',
  )
  const blocks: JSX.Element[] = []
  let compactIndex = 0
  let adIndex = 0
  let previousKind: SportsPageSlotKind | null = null

  for (const slot of slots) {
    const kind = resolveSportsPageSlotKind(slot)
    const title = slot.displayName?.trim() || sectionLabel(slot.positionKey)
    if (kind === 'ribbon_ad') {
      const ribbonIndex = adIndex++
      blocks.push(
        <div key={slot.id} className="space-y-2">
          <SportsPageSlotBlock
            slot={slot}
            kind={kind}
            title={title}
            pageName={pageName}
            adIndex={ribbonIndex}
          />
        </div>,
      )
      previousKind = kind
      continue
    }
    if (kind === 'section_archive') {
      previousKind = kind
      continue
    }
    const showAdBefore =
      !useConfiguredRibbons &&
      shouldInsertSportsAdBefore({ kind, previousKind, compactIndex })
    const beforeAdIndex = showAdBefore ? adIndex++ : null
    const heroAdIndex = !useConfiguredRibbons && kind === 'hero' ? adIndex++ : null
    blocks.push(
      <SportsSlotWithAds
        key={slot.id}
        slot={slot}
        kind={kind}
        title={title}
        pageName={pageName}
        beforeAdIndex={beforeAdIndex}
        heroAdIndex={heroAdIndex}
      />,
    )
    if (kind === 'compact_six') {
      compactIndex += 1
    }
    previousKind = kind
  }

  return <>{blocks}</>
}

/**
 * Sports-style slot with optional before/after heuristic ribbons.
 *
 * @param props Slot, kind, and ribbon indexes.
 * @returns The slot block.
 */
function SportsSlotWithAds({
  slot,
  kind,
  title,
  pageName,
  beforeAdIndex,
  heroAdIndex,
}: {
  slot: IFeedSlot
  kind: SportsPageSlotKind
  title: string
  pageName: string
  beforeAdIndex: number | null
  heroAdIndex: number | null
}): JSX.Element {
  return (
    <div className="space-y-2">
      {beforeAdIndex !== null ? (
        <AdRibbon
          index={beforeAdIndex}
          location="before_section"
          anchorSlug={normalizedPositionKey(slot)}
        />
      ) : null}
      <SportsPageSlotBlock slot={slot} kind={kind} title={title} pageName={pageName} />
      {heroAdIndex !== null ? <HeroAdRibbon index={heroAdIndex} /> : null}
    </div>
  )
}
