'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAds } from '@/context/ad-provider'
import {
  articleSlugFromPath,
  clearHeroVideoAdPending,
  markHeroVideoAdPending,
  normalizeHeroVideoAdSlug,
  peekHeroVideoAdPending,
  shouldShowHeroVideoAd,
} from '@/lib/helpers/hero-video-ad'

interface IHeroVideoAdContextValue {
  destinationSlug: string | null
  open: (slug: string) => void
  close: () => void
}

const HeroVideoAdContext = createContext<IHeroVideoAdContextValue | null>(null)
const HeroVideoAdInterceptContext = createContext(false)

/**
 * Site-level controller for the centered homepage video advertisement.
 *
 * @param props Public-site child tree.
 * @returns Provider wrapping overlay state and navigation.
 */
export function HeroVideoAdProvider({ children }: { children: ReactNode }): JSX.Element {
  const { mode } = useAds()
  const router = useRouter()
  const pathname = usePathname()
  const [destinationSlug, setDestinationSlug] = useState<string | null>(null)
  const destinationRef = useRef<string | null>(null)
  destinationRef.current = destinationSlug

  const open = useCallback(
    (slug: string) => {
      if (mode === 'off') {
        return
      }
      const normalized = normalizeHeroVideoAdSlug(slug)
      markHeroVideoAdPending(normalized)
      setDestinationSlug(normalized)
    },
    [mode],
  )

  const close = useCallback(() => {
    const slug = destinationRef.current
    clearHeroVideoAdPending()
    setDestinationSlug(null)
    if (!slug) {
      return
    }
    if (articleSlugFromPath(pathname) === slug) {
      return
    }
    router.push(`/article/${encodeURIComponent(slug)}`)
  }, [pathname, router])

  useEffect(() => {
    if (destinationSlug || mode === 'off') {
      return
    }
    const pendingSlug = peekHeroVideoAdPending()
    const pathSlug = articleSlugFromPath(pathname)
    if (!pathSlug) {
      return
    }
    if (shouldShowHeroVideoAd({ pendingSlug, articleSlug: pathSlug, mode })) {
      setDestinationSlug(pathSlug)
    }
  }, [destinationSlug, mode, pathname])

  const value = useMemo<IHeroVideoAdContextValue>(
    () => ({ destinationSlug, open, close }),
    [close, destinationSlug, open],
  )

  return <HeroVideoAdContext.Provider value={value}>{children}</HeroVideoAdContext.Provider>
}

/**
 * Mark homepage story links so a primary click opens the centered video ad.
 *
 * @param props Child tree of the public homepage.
 * @returns Provider wrapping homepage story cards.
 */
export function HeroVideoAdScope({ children }: { children: ReactNode }): JSX.Element {
  return (
    <HeroVideoAdInterceptContext.Provider value={true}>{children}</HeroVideoAdInterceptContext.Provider>
  )
}

/**
 * Read the site-level video ad controller.
 *
 * @returns Controller value, or null outside the public site provider.
 */
export function useHeroVideoAd(): IHeroVideoAdContextValue | null {
  return useContext(HeroVideoAdContext)
}

/**
 * Whether the nearest article link should intercept clicks for the video ad.
 *
 * @returns True only inside the public homepage.
 */
export function useHeroVideoAdScope(): boolean {
  return useContext(HeroVideoAdInterceptContext)
}

/**
 * Whether a click should keep native link behavior (new tab, modified click).
 *
 * @param event Mouse event from an article link.
 * @returns True when the browser should navigate without the overlay.
 */
export function isUnmodifiedPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
