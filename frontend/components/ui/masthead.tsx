'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useMarket, MARKET_OPTIONS } from '@/context/market-context'
import { useFeed } from '@/hooks/use-feed'
import { isHomepageSectionVisible, sectionAnchorId } from '@/lib/helpers/section-labels'
import { PRESENTATION_GRID_4 } from '@/lib/presentation-types'
import { MORE_TOP_STORIES_KEY } from '@/components/features/homepage-editorial-band'

interface IMastheadProps {
  activeSection?: string
}

interface IMastheadNavLink {
  key: string
  href: string
  label: string
  active: boolean
}

interface ISectionNavigationProps {
  activeSection?: string
}

const SCROLL_DIRECTION_THRESHOLD_PX = 8
const LAYOUT_SCROLL_SUPPRESS_MS = 500

function MastheadDesktopSectionNav({
  navLinks,
}: {
  navLinks: IMastheadNavLink[]
}): JSX.Element {
  return (
    <nav className="hidden flex-1 items-center gap-4 md:flex" aria-label="Sections">
      {navLinks.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          className={[
            'text-[13px] font-semibold text-neutral-800 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)] focus-visible:ring-offset-2',
            link.active ? 'underline decoration-[color:var(--brand-red)] decoration-2 underline-offset-8' : '',
          ].join(' ')}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

function MastheadMobileSectionNav({
  navLinks,
  mobileOpen,
  onNavigate,
}: {
  navLinks: IMastheadNavLink[]
  mobileOpen: boolean
  onNavigate: () => void
}): JSX.Element | null {
  if (!mobileOpen) return null

  return (
    <nav
      id="mobile-nav"
      className="site-container border-t border-neutral-200 bg-white py-3 md:hidden"
      aria-label="Mobile sections"
    >
      <ul className="space-y-2">
        {navLinks.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              className="block py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]"
              onClick={onNavigate}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function useMastheadNavLinks(activeSection?: string): IMastheadNavLink[] {
  const { data: feed } = useFeed()

  const navSlots =
    feed?.slots.filter(
      (s) =>
        s.presentationType === PRESENTATION_GRID_4 &&
        s.displayName &&
        isHomepageSectionVisible(s.positionKey),
    ) ?? []

  return [
    ...navSlots.map((s) => ({
      key: s.id,
      href: `/#${sectionAnchorId(s.positionKey)}`,
      label: s.displayName ?? s.positionKey,
      active: activeSection?.toLowerCase() === s.positionKey.toLowerCase(),
    })),
    {
      key: 'more',
      href: `/#${sectionAnchorId(MORE_TOP_STORIES_KEY)}`,
      label: 'More',
      active: false,
    },
  ]
}

function MastheadSectionNavigation({ activeSection }: ISectionNavigationProps): JSX.Element {
  const navLinks = useMastheadNavLinks(activeSection)

  return <MastheadDesktopSectionNav navLinks={navLinks} />
}

function MastheadMobileSectionNavigation({
  activeSection,
  mobileOpen,
  onNavigate,
}: ISectionNavigationProps & { mobileOpen: boolean; onNavigate: () => void }): JSX.Element | null {
  const navLinks = useMastheadNavLinks(activeSection)

  return <MastheadMobileSectionNav navLinks={navLinks} mobileOpen={mobileOpen} onNavigate={onNavigate} />
}

function MastheadSectionNavigationFallback(): JSX.Element {
  return (
    <MastheadDesktopSectionNav
      navLinks={[
        {
          key: 'more',
          href: `/#${sectionAnchorId(MORE_TOP_STORIES_KEY)}`,
          label: 'More',
          active: false,
        },
      ]}
    />
  )
}

function MastheadMobileSectionNavigationFallback({
  mobileOpen,
  onNavigate,
}: {
  mobileOpen: boolean
  onNavigate: () => void
}): JSX.Element | null {
  return (
    <MastheadMobileSectionNav
      navLinks={[
        {
          key: 'more',
          href: `/#${sectionAnchorId(MORE_TOP_STORIES_KEY)}`,
          label: 'More',
          active: false,
        },
      ]}
      mobileOpen={mobileOpen}
      onNavigate={onNavigate}
    />
  )
}

/**
 * Newsroom masthead with market selector, mobile nav, and section links from the active feed.
 */
export function Masthead({ activeSection }: IMastheadProps): JSX.Element {
  const { marketCode, setMarketCode } = useMarket()
  const [isMounted, setIsMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adRibbonVisible, setAdRibbonVisible] = useState(true)
  const [isScrolled, setIsScrolled] = useState(false)
  const [layoutHeight, setLayoutHeight] = useState(0)
  const layoutRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const adRibbonVisibleRef = useRef(true)
  const suppressScrollReactionsUntilRef = useRef(0)
  const lastScrollYRef = useRef(0)

  adRibbonVisibleRef.current = adRibbonVisible

  const setAdRibbonVisibleWithSuppress = (next: boolean) => {
    if (adRibbonVisibleRef.current === next) return
    // Avoid immediate "bounce" caused by header height changes shifting scrollY.
    suppressScrollReactionsUntilRef.current = Date.now() + LAYOUT_SCROLL_SUPPRESS_MS
    lastScrollYRef.current = window.scrollY
    setAdRibbonVisible(next)
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const layout = layoutRef.current
    if (!layout) return

    const updateLayoutHeight = () => {
      setLayoutHeight(layout.offsetHeight)
    }

    updateLayoutHeight()
    const observer = new ResizeObserver(updateLayoutHeight)
    observer.observe(layout)

    return () => observer.disconnect()
  }, [adRibbonVisible, mobileOpen, isMounted, isScrolled])

  useEffect(() => {
    lastScrollYRef.current = window.scrollY
    setIsScrolled(window.scrollY > 0)

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const previousScrollY = lastScrollYRef.current
      const now = Date.now()

      setIsScrolled(currentScrollY > 0)

      if (currentScrollY <= 0) {
        lastScrollYRef.current = currentScrollY
        setAdRibbonVisibleWithSuppress(true)
        return
      }

      const scrollDelta = currentScrollY - previousScrollY
      if (scrollDelta === 0) {
        return
      }

      const direction = scrollDelta > 0 ? 'down' : 'up'
      const suppressScrollReactions = now < suppressScrollReactionsUntilRef.current

      if (direction === 'down') {
        if (!suppressScrollReactions && scrollDelta >= SCROLL_DIRECTION_THRESHOLD_PX) {
          if (adRibbonVisibleRef.current) setAdRibbonVisibleWithSuppress(false)
        }
      } else {
        if (!suppressScrollReactions && scrollDelta <= -SCROLL_DIRECTION_THRESHOLD_PX) {
          if (!adRibbonVisibleRef.current) setAdRibbonVisibleWithSuppress(true)
        }
      }
      lastScrollYRef.current = currentScrollY
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <>
      <div
        ref={layoutRef}
        className={isScrolled ? 'fixed top-0 left-0 right-0 z-40' : 'relative'}
      >
        <div
          className={[
            'grid overflow-hidden border-neutral-200 bg-neutral-100 text-neutral-900 transition-[grid-template-rows] duration-300 ease-out',
            adRibbonVisible ? 'grid-rows-[1fr] border-b' : 'grid-rows-[0fr]',
          ].join(' ')}
          aria-hidden={!adRibbonVisible}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="site-container flex items-center justify-between gap-12 py-8">
              <div>
                <p className="text-[2.5rem] font-black uppercase leading-none tracking-[0.28em] text-neutral-500">
                  Advertisement
                </p>
                <p className="text-5xl font-semibold leading-tight text-neutral-700">
                  Premium placement available for your brand story.
                </p>
              </div>
              <Link
                href="/"
                className="shrink-0 rounded-sm border border-neutral-300 px-12 py-4 text-2xl font-bold uppercase tracking-[0.16em] text-neutral-900 hover:text-neutral-950"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>

        <div ref={navRef} className="relative z-50 shrink-0 border-b border-neutral-200 bg-white">
        <div className="site-container flex items-center gap-4 py-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex rounded-sm bg-[color:var(--brand-red)] px-2 py-1 text-xs font-black tracking-[0.28em] text-white">
              NEWSCORE
            </span>
          </Link>

          <button
            type="button"
            className="inline-flex items-center rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-900 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)] focus-visible:ring-offset-2"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? 'Close menu' : 'Menu'}
          </button>

          {isMounted ? (
            <MastheadSectionNavigation activeSection={activeSection} />
          ) : (
            <MastheadSectionNavigationFallback />
          )}

          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="sr-only">Market</span>
              <select
                value={marketCode}
                onChange={(e) => setMarketCode(e.target.value)}
                className="rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]"
                aria-label="Select news market"
              >
                {MARKET_OPTIONS.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="hidden rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 md:inline-flex">
              Watch
            </span>
            <span className="hidden rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 md:inline-flex">
              Listen
            </span>
            <span className="rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-900">
              Sign in
            </span>
          </div>
        </div>

        {isMounted ? (
          <MastheadMobileSectionNavigation
            activeSection={activeSection}
            mobileOpen={mobileOpen}
            onNavigate={() => setMobileOpen(false)}
          />
        ) : (
          <MastheadMobileSectionNavigationFallback
            mobileOpen={mobileOpen}
            onNavigate={() => setMobileOpen(false)}
          />
        )}
        </div>
      </div>
      {isScrolled && layoutHeight > 0 ? (
        <div className="w-full shrink-0" style={{ height: layoutHeight }} aria-hidden />
      ) : null}
    </>
  )
}
