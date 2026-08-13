'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { AdSlot } from '@/components/ui/ad-slot'
import { STICKY_RIBBON_AD_HEIGHT_PX } from '@/lib/ad-config'

/**
 * Sticky creative width used by El Vocero desktop sticky ads (728×90).
 * Measured from `#sticky-anchor` iframe on elvocero.com article pages.
 */
const STICKY_RIBBON_CREATIVE_MAX_WIDTH_PX = 728

/**
 * Full-width sticky bar uses a light black overlay so left/right gutters stay
 * see-through over article content without dominating the page.
 */
const STICKY_RIBBON_BAR_BG_CLASS = 'bg-black/25'

interface IStickyAdRibbonCloseButtonProps {
  label: string
  onClose: () => void
}

/**
 * Circular dismiss control anchored to the top-left of the sticky creative.
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
      className="absolute -top-3 left-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-800 bg-white text-neutral-900 shadow-sm transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <span aria-hidden="true" className="text-sm font-bold leading-none">
        ×
      </span>
    </button>
  )
}

/**
 * Fixed bottom advertisement ribbon for article pages, dismissible via an X.
 *
 * Layout matched to El Vocero article sticky ads:
 * - full-viewport-width bar
 * - semi-transparent left/right gutters (`rgba(0,0,0,0.5)`)
 * - centered 728×90 creative
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
        className={`fixed inset-x-0 bottom-0 z-40 ${STICKY_RIBBON_BAR_BG_CLASS}`}
        style={{ height: STICKY_RIBBON_AD_HEIGHT_PX }}
      >
        <div
          className="relative mx-auto h-full w-full"
          style={{ maxWidth: STICKY_RIBBON_CREATIVE_MAX_WIDTH_PX }}
        >
          <StickyAdRibbonCloseButton
            label={tAds('closeAdvertisement')}
            onClose={() => setDismissed(true)}
          />
          <AdSlot slotKey="article-sticky-ribbon" />
        </div>
      </aside>
    </>
  )
}
