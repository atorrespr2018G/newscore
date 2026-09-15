'use client'

import { useSectionLabels } from '@/hooks/use-section-labels'
import { useSyncPageAdPlacements } from '@/context/page-ads-context'
import { MainPageOrderedSections } from '@/components/features/homepage-slot-walk'
import { SportsPageSections } from '@/components/features/sports-page-sections'
import { isSportsStylePageName } from '@/lib/helpers/homepage-page-names'
import { omitDisabledLandingSlots } from '@/lib/helpers/page-visibility'
import type { IHomepageFeed } from '@/interfaces/feed'

const HOMEPAGE_STACK_CLASS =
  'space-y-2 [&_a:hover]:text-neutral-950 [&_a:hover]:underline [&_button:hover]:text-neutral-950 [&_button:hover]:underline'

interface IHomepageContentOptions {
  /** Sports page: render dynamic sport rows (two sections, then an ad ribbon). */
  useSportsSectionRows?: boolean
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
  const slots = omitDisabledLandingSlots(
    feed.slots ?? [],
    feed.disabledPageNames,
    pageName,
  )
  if (slots.length === 0) {
    return <div className="text-neutral-600">No homepage slots configured.</div>
  }

  const useSportsSectionRows =
    options?.useSportsSectionRows === true || isSportsStylePageName(pageName)

  if (useSportsSectionRows) {
    return (
      <div className={HOMEPAGE_STACK_CLASS}>
        <SportsPageSections slots={slots} sectionLabel={sectionLabel} pageName={pageName} />
      </div>
    )
  }

  return (
    <div className={HOMEPAGE_STACK_CLASS}>
      <MainPageOrderedSections
        slots={slots}
        sectionLabel={sectionLabel}
        pageName={pageName}
      />
    </div>
  )
}
