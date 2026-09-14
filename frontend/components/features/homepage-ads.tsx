'use client'

import { useTranslations } from 'next-intl'
import { AdSlot } from '@/components/ui/ad-slot'
import { HOMEPAGE_FIRST_RIBBON_AD_SHELL_CLASS } from '@/lib/ad-config'
import { usePageAds } from '@/context/page-ads-context'
import type { PageAdLocation } from '@/lib/helpers/page-ad-placements'

/** Props for a homepage in-feed advertisement ribbon. */
export interface IAdRibbonProps {
  index?: number
  location?: PageAdLocation
  anchorSlug?: string | null
  enlargeFirst?: boolean
}

/**
 * Shell class for a homepage in-feed ribbon.
 *
 * @param index Zero-based ribbon occurrence on the page.
 * @param enlargeFirst When true, the first ribbon is 25% taller than default.
 * @returns Tailwind override for the first enlarged ribbon, otherwise undefined.
 */
function homepageRibbonShellClass(index: number, enlargeFirst: boolean): string | undefined {
  if (!enlargeFirst || index !== 0) {
    return undefined
  }
  return HOMEPAGE_FIRST_RIBBON_AD_SHELL_CLASS
}

/**
 * Homepage section ribbon backed by the shared AdSlot mock/GAM unit.
 *
 * Presence is owned by ribbon_ad section rows or leftover heuristics, not
 * the Advertisements panel.
 *
 * @param props Ribbon index, location, and optional section anchor.
 * @returns The homepage in-feed advertisement ribbon.
 */
export function AdRibbon({
  index = 0,
  location = 'before_section',
  anchorSlug,
  enlargeFirst = false,
}: IAdRibbonProps): JSX.Element {
  const t = useTranslations('common')
  const { variantFor } = usePageAds()

  return (
    <section aria-label={t('advertisement')} className="py-4">
      <AdSlot
        slotKey="homepage-section-ribbon"
        index={index}
        variant={variantFor(location, 'ribbon', anchorSlug)}
        className={homepageRibbonShellClass(index, enlargeFirst)}
      />
    </section>
  )
}

/**
 * In-feed ribbon on the main homepage: the first occurrence is 25% taller.
 *
 * @param props Ribbon index, location, and optional section anchor.
 * @returns The homepage in-feed advertisement ribbon.
 */
export function MainPageAdRibbon(props: Omit<IAdRibbonProps, 'enlargeFirst'>): JSX.Element {
  return <AdRibbon {...props} enlargeFirst />
}

/**
 * Post-hero homepage ribbon.
 *
 * Shown only when the section list has no ribbon_ad rows.
 *
 * @param props.index Zero-based ribbon occurrence.
 * @param props.enlargeFirst When true, the first ribbon is 25% taller.
 * @returns The post-hero advertisement ribbon.
 */
export function HeroAdRibbon({
  index = 0,
  enlargeFirst = false,
}: {
  index?: number
  enlargeFirst?: boolean
}): JSX.Element {
  const t = useTranslations('common')
  const { variantFor } = usePageAds()

  return (
    <section aria-label={t('advertisement')} className="py-4">
      <AdSlot
        slotKey="homepage-hero-after"
        index={index}
        variant={variantFor('after_hero', 'ribbon')}
        className={homepageRibbonShellClass(index, enlargeFirst)}
      />
    </section>
  )
}
