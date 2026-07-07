'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocale } from '@/context/locale-context'
import { useMarket, MARKET_OPTIONS } from '@/context/market-context'
import { FLORIDA_COUNTY_OPTIONS, FLORIDA_STATE_CODE } from '@/lib/florida-counties'
import { PUERTO_RICO_MARKET_CODE, PUERTO_RICO_TOWN_OPTIONS } from '@/lib/puerto-rico-towns'
import { US_MARKET_CODE, US_STATE_OPTIONS } from '@/lib/us-states'
import { useFeed } from '@/hooks/use-feed'
import { useLanguageRegistry } from '@/hooks/use-language-registry'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { ADMINISTRATOR_ROUTE } from '@/lib/api/admin-routes'
import {
  isHomepageSectionVisible,
  sectionAnchorId,
  sectionNavHref,
  sectionPagePath,
} from '@/lib/helpers/section-labels'
import { PRESENTATION_GRID_4 } from '@/lib/presentation-types'
import { MORE_TOP_STORIES_KEY } from '@/components/features/homepage-editorial-band'

interface IMastheadProps {
  activeSection?: string
  /** Controls whether the top advertisement ribbon is rendered. Defaults to true. */
  showAdRibbon?: boolean
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

const MASTHEAD_UNLOCK_DELAY_MS = 2000
const MASTHEAD_UNLOCK_TRANSITION_RESET_MS = 2200

const DEFAULT_MASTHEAD_SECTION_KEYS = [
  'politics',
  'world',
  'technology',
  'business',
  'health',
  'finance',
  'entertainment',
] as const

function useMounted(): boolean {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return isMounted
}

function useScrollY(): number {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onScroll = (): void => {
      setScrollY(window.scrollY)
    }

    setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return scrollY
}

function useMastheadUnlock(pathname: string): { lockActive: boolean; unlockTransitionActive: boolean } {
  const [lockActive, setLockActive] = useState(true)
  const [unlockTransitionActive, setUnlockTransitionActive] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setLockActive(true)
    setUnlockTransitionActive(false)

    const lockTimer = window.setTimeout(() => {
      setUnlockTransitionActive(true)
      setLockActive(false)
    }, MASTHEAD_UNLOCK_DELAY_MS)
    const transitionTimer = window.setTimeout(() => {
      setUnlockTransitionActive(false)
    }, MASTHEAD_UNLOCK_TRANSITION_RESET_MS)

    return () => {
      window.clearTimeout(lockTimer)
      window.clearTimeout(transitionTimer)
    }
  }, [pathname])

  return { lockActive, unlockTransitionActive }
}

function useMeasuredHeights(
  ribbonRef: RefObject<HTMLElement>,
  navRef: RefObject<HTMLDivElement>,
  deps: readonly unknown[],
): { ribbonHeight: number; navHeight: number } {
  const [ribbonHeight, setRibbonHeight] = useState(0)
  const [navHeight, setNavHeight] = useState(0)

  useEffect(() => {
    const navEl = navRef.current
    if (!navEl) return

    const updateHeights = (): void => {
      setRibbonHeight(ribbonRef.current?.offsetHeight ?? 0)
      setNavHeight(navEl.offsetHeight)
    }

    updateHeights()
    const observer = new ResizeObserver(updateHeights)
    observer.observe(navEl)
    const ribbonEl = ribbonRef.current
    if (ribbonEl) {
      observer.observe(ribbonEl)
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ribbonHeight, navHeight }
}

function MastheadDesktopSectionNav({
  navLinks,
  sectionsLabel,
}: {
  navLinks: IMastheadNavLink[]
  sectionsLabel: string
}): JSX.Element {
  return (
    <nav className="hidden flex-1 items-center gap-4 md:flex" aria-label={sectionsLabel}>
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
  mobileSectionsLabel,
}: {
  navLinks: IMastheadNavLink[]
  mobileOpen: boolean
  onNavigate: () => void
  mobileSectionsLabel: string
}): JSX.Element | null {
  if (!mobileOpen) return null

  return (
    <nav
      id="mobile-nav"
      className="site-container border-t border-neutral-200 bg-white py-3 md:hidden"
      aria-label={mobileSectionsLabel}
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

function withMoreLink(navLinks: IMastheadNavLink[], moreLabel: string): IMastheadNavLink[] {
  return [
    ...navLinks,
    {
      key: 'more',
      href: `/#${sectionAnchorId(MORE_TOP_STORIES_KEY)}`,
      label: moreLabel,
      active: false,
    },
  ]
}

function buildFallbackNavLinks(
  pathname: string,
  activeSection: string | undefined,
  sectionLabel: (positionKey: string) => string,
): IMastheadNavLink[] {
  return DEFAULT_MASTHEAD_SECTION_KEYS.map((positionKey) => {
    const pagePath = sectionPagePath(positionKey)
    const href = sectionNavHref(positionKey)
    const isPageRouteMatch = pagePath !== null && pathname === pagePath

    return {
      key: `fallback-${positionKey}`,
      href,
      label: sectionLabel(positionKey),
      active: activeSection?.toLowerCase() === positionKey || isPageRouteMatch,
    }
  })
}

function useMastheadNavLinks(activeSection?: string): IMastheadNavLink[] {
  const pathname = usePathname()
  const { data: feed } = useFeed()
  const { sectionLabel, homepageSectionTitle } = useSectionLabels()
  const t = useTranslations('navigation')

  const navSlots =
    feed?.slots.filter(
      (s) =>
        s.presentationType === PRESENTATION_GRID_4 &&
        s.displayName &&
        isHomepageSectionVisible(s.positionKey),
    ) ?? []

  const dynamicNavLinks = navSlots.map((s) => {
    const positionKey = s.positionKey.toLowerCase()
    const pagePath = sectionPagePath(s.positionKey)

    return {
      key: s.id,
      href: sectionNavHref(s.positionKey),
      label: homepageSectionTitle(s.positionKey, s.displayName),
      active:
        activeSection?.toLowerCase() === positionKey ||
        (pagePath !== null && pathname === pagePath),
    }
  })

  const fallbackNavLinks = buildFallbackNavLinks(pathname, activeSection, sectionLabel)
  const baseNavLinks = dynamicNavLinks.length > 0 ? dynamicNavLinks : fallbackNavLinks

  return withMoreLink(baseNavLinks, t('more'))
}

function MastheadSectionNavigation({ activeSection }: ISectionNavigationProps): JSX.Element {
  const navLinks = useMastheadNavLinks(activeSection)
  const t = useTranslations('navigation')

  return <MastheadDesktopSectionNav navLinks={navLinks} sectionsLabel={t('sections')} />
}

function MastheadMobileSectionNavigation({
  activeSection,
  mobileOpen,
  onNavigate,
}: ISectionNavigationProps & { mobileOpen: boolean; onNavigate: () => void }): JSX.Element | null {
  const navLinks = useMastheadNavLinks(activeSection)
  const t = useTranslations('navigation')

  return (
    <MastheadMobileSectionNav
      navLinks={navLinks}
      mobileOpen={mobileOpen}
      onNavigate={onNavigate}
      mobileSectionsLabel={t('mobileSections')}
    />
  )
}

function MastheadSectionNavigationFallback({ activeSection }: ISectionNavigationProps): JSX.Element {
  const pathname = usePathname()
  const { sectionLabel } = useSectionLabels()
  const t = useTranslations('navigation')

  return (
    <MastheadDesktopSectionNav
      navLinks={withMoreLink(buildFallbackNavLinks(pathname, activeSection, sectionLabel), t('more'))}
      sectionsLabel={t('sections')}
    />
  )
}

function MastheadMobileSectionNavigationFallback({
  activeSection,
  mobileOpen,
  onNavigate,
}: ISectionNavigationProps & { mobileOpen: boolean; onNavigate: () => void }): JSX.Element | null {
  const pathname = usePathname()
  const { sectionLabel } = useSectionLabels()
  const t = useTranslations('navigation')

  return (
    <MastheadMobileSectionNav
      navLinks={withMoreLink(buildFallbackNavLinks(pathname, activeSection, sectionLabel), t('more'))}
      mobileOpen={mobileOpen}
      onNavigate={onNavigate}
      mobileSectionsLabel={t('mobileSections')}
    />
  )
}

function MastheadAdRibbon({ ribbonRef }: { ribbonRef: RefObject<HTMLElement> }): JSX.Element {
  const tCommon = useTranslations('common')

  return (
    <section
      ref={ribbonRef}
      aria-label={tCommon('advertisement')}
      className="border-b border-neutral-200 bg-neutral-100 text-neutral-900"
    >
      <div className="site-container flex items-center justify-between gap-12 py-8">
        <div>
          <p className="text-[2.5rem] font-black uppercase leading-none tracking-[0.28em] text-neutral-500">
            {tCommon('advertisement')}
          </p>
          <p className="text-5xl font-semibold leading-tight text-neutral-700">
            {tCommon('premiumPlacement')}
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-sm border border-neutral-300 px-12 py-4 text-2xl font-bold uppercase tracking-[0.16em] text-neutral-900 hover:text-neutral-950"
        >
          {tCommon('learnMore')}
        </Link>
      </div>
    </section>
  )
}

function MastheadBrandLink(): JSX.Element {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="inline-flex rounded-sm bg-[color:var(--brand-red)] px-2 py-1 text-xs font-black tracking-[0.28em] text-white">
        NEWSCORE
      </span>
    </Link>
  )
}

function MastheadMobileToggle({
  mobileOpen,
  onToggle,
}: {
  mobileOpen: boolean
  onToggle: () => void
}): JSX.Element {
  const tNav = useTranslations('navigation')

  return (
    <button
      type="button"
      className="inline-flex items-center rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-900 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)] focus-visible:ring-offset-2"
      aria-expanded={mobileOpen}
      aria-controls="mobile-nav"
      onClick={onToggle}
    >
      {mobileOpen ? tNav('closeMenu') : tNav('menu')}
    </button>
  )
}

function MastheadListenBadge(): JSX.Element {
  const tNav = useTranslations('navigation')

  return (
    <span className="hidden rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 md:inline-flex">
      {tNav('listen')}
    </span>
  )
}

function MastheadLanguageSelector(): JSX.Element {
  const { locale, setLocale } = useLocale()
  const languages = useLanguageRegistry()
  const tNav = useTranslations('navigation')

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{tNav('language')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]"
        aria-label={tNav('selectLanguage')}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.nativeName}
          </option>
        ))}
      </select>
    </label>
  )
}

function MastheadMarketSelector(): JSX.Element {
  const { marketCode, setMarketCode } = useMarket()
  const tNav = useTranslations('navigation')

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{tNav('market')}</span>
      <select
        value={marketCode}
        onChange={(e) => setMarketCode(e.target.value)}
        className="rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]"
        aria-label={tNav('selectMarket')}
      >
        {MARKET_OPTIONS.map((m) => (
          <option key={m.code} value={m.code}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function MastheadLocalitySelector(): JSX.Element | null {
  const { marketCode, town, setTown } = useMarket()
  const tNav = useTranslations('navigation')
  const selectClassName =
    'rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]'

  if (marketCode === US_MARKET_CODE) {
    return (
      <label className="flex items-center gap-2">
        <span className="sr-only">{tNav('state')}</span>
        <select
          value={town ?? ''}
          onChange={(event) => setTown(event.target.value || null)}
          className={selectClassName}
          aria-label={tNav('selectState')}
        >
          <option value="">{tNav('localityDefaultUs')}</option>
          {US_STATE_OPTIONS.map((stateOption) => (
            <option key={stateOption.code} value={stateOption.code}>
              {stateOption.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (marketCode === PUERTO_RICO_MARKET_CODE) {
    return (
      <label className="flex items-center gap-2">
        <span className="sr-only">{tNav('town')}</span>
        <select
          value={town ?? ''}
          onChange={(event) => setTown(event.target.value || null)}
          className={selectClassName}
          aria-label={tNav('selectTown')}
        >
          <option value="">{tNav('localityDefaultPr')}</option>
          {PUERTO_RICO_TOWN_OPTIONS.map((townOption) => (
            <option key={townOption.code} value={townOption.code}>
              {townOption.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return null
}

function MastheadFloridaCountySelector(): JSX.Element | null {
  const { marketCode, town, county, setCounty } = useMarket()
  const tNav = useTranslations('navigation')

  if (marketCode !== US_MARKET_CODE || town !== FLORIDA_STATE_CODE) {
    return null
  }

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{tNav('county')}</span>
      <select
        value={county ?? ''}
        onChange={(event) => setCounty(event.target.value || null)}
        className="rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]"
        aria-label={tNav('selectCounty')}
      >
        <option value="">{tNav('county')}</option>
        {FLORIDA_COUNTY_OPTIONS.map((countyOption) => (
          <option key={countyOption.code} value={countyOption.code}>
            {countyOption.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function MastheadAdministratorLink({ pathname }: { pathname: string }): JSX.Element {
  const tNav = useTranslations('navigation')

  return (
    <Link
      href={ADMINISTRATOR_ROUTE}
      className={[
        'inline-flex items-center rounded-sm border px-2 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]',
        pathname.startsWith('/admin')
          ? 'border-[color:var(--brand-red)] bg-[color:var(--brand-red)] text-white'
          : 'border-neutral-300 text-neutral-900 hover:text-neutral-950',
      ].join(' ')}
    >
      {tNav('administrator')}
    </Link>
  )
}

function MastheadActions({ pathname }: { pathname: string }): JSX.Element {
  return (
    <div className="ml-auto flex items-center gap-3">
      <MastheadListenBadge />
      <MastheadLanguageSelector />
      <MastheadMarketSelector />
      <MastheadLocalitySelector />
      <MastheadFloridaCountySelector />
      <MastheadAdministratorLink pathname={pathname} />
    </div>
  )
}

function MastheadNavBar({
  navRef,
  activeSection,
  isMounted,
  mobileOpen,
  onToggleMobile,
  onCloseMobile,
}: {
  navRef: RefObject<HTMLDivElement>
  activeSection?: string
  isMounted: boolean
  mobileOpen: boolean
  onToggleMobile: () => void
  onCloseMobile: () => void
}): JSX.Element {
  const pathname = usePathname()

  return (
    <div ref={navRef} className="relative z-40 shrink-0 border-b border-neutral-200 bg-white shadow-sm">
      <div className="site-container flex items-center gap-4 py-2">
        <MastheadBrandLink />
        <MastheadMobileToggle mobileOpen={mobileOpen} onToggle={onToggleMobile} />
        {isMounted ? (
          <MastheadSectionNavigation activeSection={activeSection} />
        ) : (
          <MastheadSectionNavigationFallback activeSection={activeSection} />
        )}
        <MastheadActions pathname={pathname} />
      </div>

      {isMounted ? (
        <MastheadMobileSectionNavigation
          activeSection={activeSection}
          mobileOpen={mobileOpen}
          onNavigate={onCloseMobile}
        />
      ) : (
        <MastheadMobileSectionNavigationFallback
          activeSection={activeSection}
          mobileOpen={mobileOpen}
          onNavigate={onCloseMobile}
        />
      )}
    </div>
  )
}

/**
 * Newsroom masthead with market selector, mobile nav, and section links from the active feed.
 */
export function Masthead({ activeSection, showAdRibbon = true }: IMastheadProps): JSX.Element {
  const pathname = usePathname()
  const isMounted = useMounted()
  const [mobileOpen, setMobileOpen] = useState(false)
  const scrollY = useScrollY()
  const { lockActive, unlockTransitionActive } = useMastheadUnlock(pathname)
  const ribbonRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const { ribbonHeight, navHeight } = useMeasuredHeights(ribbonRef, navRef, [mobileOpen, isMounted])

  const ribbonOffset = lockActive ? 0 : Math.min(ribbonHeight, Math.max(scrollY, 0))
  const stackHeight = ribbonHeight + navHeight

  return (
    <header className="relative z-40">
      {stackHeight > 0 ? <div aria-hidden="true" className="pointer-events-none" style={{ height: stackHeight }} /> : null}

      <div
        className={[
          'fixed inset-x-0 top-0 z-50',
          unlockTransitionActive ? 'transition-transform duration-200 ease-out' : '',
        ].join(' ')}
        style={{ transform: `translateY(-${ribbonOffset}px)` }}
      >
        {showAdRibbon ? <MastheadAdRibbon ribbonRef={ribbonRef} /> : null}
        <MastheadNavBar
          navRef={navRef}
          activeSection={activeSection}
          isMounted={isMounted}
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen((open) => !open)}
          onCloseMobile={() => setMobileOpen(false)}
        />
      </div>
    </header>
  )
}
