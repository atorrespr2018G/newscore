'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { AdSlot } from '@/components/ui/ad-slot'
import { STICKY_RIBBON_AD_HEIGHT_PX } from '@/lib/ad-config'

/**
 * Sticky creative max width: 50% longer than the 728px baseline leaderboard.
 */
const STICKY_RIBBON_CREATIVE_MAX_WIDTH_PX = 1092

/**
 * Full-width sticky bar uses a light black overlay so left/right gutters stay
 * see-through over article content without dominating the page.
 */
const STICKY_RIBBON_BAR_BG_CLASS = 'bg-black/25'

/** Collapse-tab size matched to El Vocero `.sticky-anchor-close`. */
const STICKY_RIBBON_CLOSE_TAB_WIDTH_PX = 30
const STICKY_RIBBON_CLOSE_TAB_HEIGHT_PX = 29
const STICKY_RIBBON_CLOSE_TAB_RIGHT_INSET_PX = 30

interface IStickyAdRibbonCloseButtonProps {
  label: string
  onClose: () => void
}

/**
 * El Vocero–style collapse tab: rounded top, minus icon, sits above the bar.
 */
function StickyAdRibbonCloseButton({
  label,
  onClose,
}: IStickyAdRibbonCloseButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className={`absolute z-10 flex items-start justify-center ${STICKY_RIBBON_BAR_BG_CLASS} text-white transition hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
      style={{
        top: -STICKY_RIBBON_CLOSE_TAB_HEIGHT_PX,
        right: STICKY_RIBBON_CLOSE_TAB_RIGHT_INSET_PX,
        width: STICKY_RIBBON_CLOSE_TAB_WIDTH_PX,
        height: STICKY_RIBBON_CLOSE_TAB_HEIGHT_PX,
        borderRadius: '5px 5px 0 0',
        padding: '3px 7px 0',
      }}
    >
      <span aria-hidden="true" className="mt-1 block h-0.5 w-3.5 bg-white" />
    </button>
  )
}

/**
 * Fixed bottom advertisement ribbon for article pages, dismissible via a tab.
 *
 * Layout matched to El Vocero article sticky ads:
 * - full-viewport-width bar
 * - semi-transparent left/right gutters
 * - centered creative (1092px max, 50% longer than 728px)
 * - minus collapse tab on the top-right transparent region
 *
 * @returns The sticky ribbon and scroll spacer, or null after dismiss.
 */
export function StickyAdRibbon(): JSX.Element | null {
  const tAds = useTranslations('ads')
  const tCommon = useTranslations('common')
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) {
    return null
  }

  return (
    <>
      <div
        aria-hidden="true"
        style={{ height: STICKY_RIBBON_AD_HEIGHT_PX }}
        className="w-full shrink-0"
      />
      <aside
        aria-label={tCommon('advertisement')}
        className={`fixed inset-x-0 bottom-0 z-40 overflow-visible ${STICKY_RIBBON_BAR_BG_CLASS}`}
        style={{ height: STICKY_RIBBON_AD_HEIGHT_PX }}
      >
        <StickyAdRibbonCloseButton
          label={tAds('closeAdvertisement')}
          onClose={() => setDismissed(true)}
        />
        <div
          className="mx-auto h-full w-full"
          style={{ maxWidth: STICKY_RIBBON_CREATIVE_MAX_WIDTH_PX }}
        >
          <AdSlot slotKey="article-sticky-ribbon" />
        </div>
      </aside>
    </>
  )
}
