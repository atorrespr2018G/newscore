'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'

import { useAds } from '@/context/ad-provider'
import { shouldServeMockAds, type AdSlotKey } from '@/lib/ad-config'
import {
  HERO_VIDEO_AD_MAX_WIDTH_PX,
  HERO_VIDEO_AD_SKIP_AFTER_MS,
  remainingSkipSeconds,
} from '@/lib/helpers/hero-video-ad'
import { MOCK_VIDEO_AD_SRC } from '@/lib/mock-ads'
import { useHeroVideoAd } from '@/context/hero-video-ad-context'

const HERO_CLICK_VIDEO_SLOT_KEY: AdSlotKey = 'hero-click-video'

interface IHeroVideoAdCloseButtonProps {
  label: string
  onClose: () => void
}

interface IHeroVideoAdSkipButtonProps {
  remaining: number
  skipLabel: string
  waitLabel: string
  adLabel: string
  onSkip: () => void
}

/**
 * Centered video advertisement shown when a homepage story is selected.
 *
 * Matches the El Vocero high-impact pattern: the video occupies the middle
 * of the viewport until skipped or closed, then the article opens.
 *
 * @returns The overlay portal, or null when no hero-click ad is open.
 */
export function HeroVideoAdOverlay(): JSX.Element | null {
  const videoAd = useHeroVideoAd()
  const [mounted, setMounted] = useState(false)
  const open = Boolean(videoAd?.destinationSlug)
  const onClose = videoAd?.close ?? noopClose

  useEffect(() => {
    setMounted(true)
  }, [])
  useBodyScrollLock(open)
  useEscapeToClose(open, onClose)

  if (!mounted || !open) {
    return null
  }
  return createPortal(<HeroVideoAdDialog onClose={onClose} />, document.body)
}

/**
 * No-op used before the site video-ad provider is mounted.
 */
function noopClose(): void {
  return
}

/**
 * Count elapsed overlay time for the skip countdown.
 *
 * @param active Whether the overlay is visible.
 * @returns Elapsed milliseconds and whole seconds remaining until skip.
 */
function useSkipCountdown(active: boolean): { remaining: number } {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!active) {
      setElapsedMs(0)
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250)
    return () => window.clearInterval(timer)
  }, [active])

  return { remaining: remainingSkipSeconds(elapsedMs, HERO_VIDEO_AD_SKIP_AFTER_MS) }
}

/**
 * Lock page scroll while the video ad overlay is open.
 *
 * @param locked Whether scroll should be frozen.
 */
function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) {
      return
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}

/**
 * Close the overlay when the user presses Escape.
 *
 * @param active Whether the overlay is visible.
 * @param onClose Close handler.
 */
function useEscapeToClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, onClose])
}

/**
 * Dialog chrome: dimmed backdrop and centered 16:9 player.
 *
 * @param props Close handler.
 * @returns The modal dialog.
 */
function HeroVideoAdDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const tAds = useTranslations('ads')
  const tCommon = useTranslations('common')
  const skip = useSkipCountdown(true)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tAds('videoAdvertisement')}
      data-ad-slot={HERO_CLICK_VIDEO_SLOT_KEY}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="relative w-full" style={{ maxWidth: HERO_VIDEO_AD_MAX_WIDTH_PX }}>
        <HeroVideoAdCloseButton label={tAds('closeAdvertisement')} onClose={onClose} />
        <HeroVideoAdPlayer onEnded={onClose} />
        <HeroVideoAdSkipButton
          remaining={skip.remaining}
          skipLabel={tAds('skipAd')}
          waitLabel={tAds('skipAdIn', { seconds: skip.remaining })}
          adLabel={tCommon('advertisement')}
          onSkip={onClose}
        />
      </div>
    </div>
  )
}

/**
 * Mock or reserved video creative for the hero-click unit.
 *
 * @param props Handler invoked when the mock video finishes.
 * @returns The 16:9 player shell.
 */
function HeroVideoAdPlayer({ onEnded }: { onEnded: () => void }): JSX.Element {
  const { mode } = useAds()
  const tAds = useTranslations('ads')
  const playMock = shouldServeMockAds(mode)

  if (!playMock) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded bg-neutral-950 text-[11px] font-black tracking-[0.28em] text-white/70">
        {tAds('videoAdvertisement').toUpperCase()}
      </div>
    )
  }

  return (
    <video
      className="aspect-video w-full rounded bg-black object-cover"
      src={MOCK_VIDEO_AD_SRC}
      autoPlay
      muted
      playsInline
      onEnded={onEnded}
    />
  )
}

/**
 * Top-right close control for the video ad dialog.
 *
 * @param props Accessible label and close handler.
 * @returns The close button.
 */
function HeroVideoAdCloseButton({
  label,
  onClose,
}: IHeroVideoAdCloseButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="absolute -top-3 right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg leading-none text-neutral-900 shadow hover:bg-neutral-100"
    >
      ×
    </button>
  )
}

/**
 * Skip control that counts down, then lets the reader dismiss the ad.
 *
 * @param props Remaining seconds, labels, and skip handler.
 * @returns The skip bar under the player.
 */
function HeroVideoAdSkipButton({
  remaining,
  skipLabel,
  waitLabel,
  adLabel,
  onSkip,
}: IHeroVideoAdSkipButtonProps): JSX.Element {
  const canSkip = remaining === 0
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-white">
      <p className="text-[11px] font-black tracking-[0.24em] text-white/70">{adLabel.toUpperCase()}</p>
      <button
        type="button"
        onClick={onSkip}
        disabled={!canSkip}
        className="rounded bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-neutral-950 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-white"
      >
        {canSkip ? skipLabel : waitLabel}
      </button>
    </div>
  )
}
