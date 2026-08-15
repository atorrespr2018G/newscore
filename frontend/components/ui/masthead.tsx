'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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
  isSectionPageActive,
  sectionAnchorId,
  sectionKeyFromPathname,
  sectionNavHref,
} from '@/lib/helpers/section-labels'
import { PRESENTATION_GRID_4 } from '@/lib/presentation-types'
import { MORE_TOP_STORIES_KEY } from '@/components/features/homepage-editorial-band'
import { AdSlot } from '@/components/ui/ad-slot'
import { usePageAds } from '@/context/page-ads-context'

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

/** Pinned leaderboard sits behind page chrome so content can cover it on scroll. */
const MASTHEAD_AD_LAYER_CLASS = 'sticky top-0 z-0'

/** Section nav paints over the pinned leaderboard, then stays at the top. */
const MASTHEAD_NAV_LAYER_CLASS = 'sticky top-0 z-40 bg-white'

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

function MastheadDesktopSectionNav({
  navLinks,
  sectionsLabel,
}: {
  navLinks: IMastheadNavLink[]
  sectionsLabel: string
}): JSX.Element {
  return (
    <nav className="hidden flex-1 items-center gap-4 md:ml-4 md:flex" aria-label={sectionsLabel}>
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
    const href = sectionNavHref(positionKey)

    return {
      key: `fallback-${positionKey}`,
      href,
      label: sectionLabel(positionKey),
      active: activeSection?.toLowerCase() === positionKey || isSectionPageActive(pathname, positionKey),
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

    return {
      key: s.id,
      href: sectionNavHref(s.positionKey),
      label: homepageSectionTitle(s.positionKey, s.displayName),
      active:
        activeSection?.toLowerCase() === positionKey || isSectionPageActive(pathname, positionKey),
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

/**
 * Masthead leaderboard that stays pinned while page chrome scrolls over it.
 */
function MastheadAdRibbon(): JSX.Element | null {
  const tCommon = useTranslations('common')
  const { shouldRender, variantFor } = usePageAds()
  if (!shouldRender('masthead')) {
    return null
  }

  return (
    <div className={MASTHEAD_AD_LAYER_CLASS}>
      <section
        aria-label={tCommon('advertisement')}
        className="border-b border-neutral-200 bg-neutral-100 text-neutral-900"
      >
        <div className="site-container py-4">
          <AdSlot
            slotKey="masthead-leaderboard"
            variant={variantFor('masthead', 'leaderboard')}
          />
        </div>
      </section>
    </div>
  )
}

function MastheadBrandLink(): JSX.Element {
  const pathname = usePathname()
  const { sectionLabel } = useSectionLabels()
  const pageKey = sectionKeyFromPathname(pathname)
  const pageTitle = pageKey ? sectionLabel(pageKey) : null

  return (
    <div className="flex items-center gap-2">
      <Link href="/" className="flex items-center">
        <span className="inline-flex rounded-sm bg-[color:var(--brand-red)] px-2 py-1 text-xs font-black tracking-[0.28em] text-white">
          NEWSCORE
        </span>
      </Link>
      {pageTitle ? (
        <span className="text-[1.05rem] font-semibold leading-none tracking-tight text-neutral-800">
          {pageTitle}
        </span>
      ) : null}
    </div>
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
      <MastheadLanguageSelector />
      <MastheadMarketSelector />
      <MastheadLocalitySelector />
      <MastheadFloridaCountySelector />
      <MastheadAdministratorLink pathname={pathname} />
    </div>
  )
}

function MastheadNavBar({
  activeSection,
  isMounted,
  mobileOpen,
  onToggleMobile,
  onCloseMobile,
}: {
  activeSection?: string
  isMounted: boolean
  mobileOpen: boolean
  onToggleMobile: () => void
  onCloseMobile: () => void
}): JSX.Element {
  const pathname = usePathname()

  return (
    <div className="shrink-0 border-b border-neutral-200 bg-white shadow-sm">
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
  const isMounted = useMounted()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {showAdRibbon ? <MastheadAdRibbon /> : null}
      <header className={MASTHEAD_NAV_LAYER_CLASS}>
        <MastheadNavBar
          activeSection={activeSection}
          isMounted={isMounted}
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen((open) => !open)}
          onCloseMobile={() => setMobileOpen(false)}
        />
      </header>
    </>
  )
}
