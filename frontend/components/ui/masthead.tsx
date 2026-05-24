'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useMarket, MARKET_OPTIONS } from '@/context/market-context'
import { useFeed } from '@/hooks/use-feed'
import { sectionAnchorId } from '@/lib/helpers/section-labels'
import { PRESENTATION_GRID_4 } from '@/lib/presentation-types'
import { MORE_TOP_STORIES_KEY } from '@/components/features/homepage-editorial-band'

interface IMastheadProps {
  activeSection?: string
}

/**
 * Newsroom masthead with market selector, mobile nav, and section links from the active feed.
 */
export function Masthead({ activeSection }: IMastheadProps): JSX.Element {
  const { marketCode, setMarketCode } = useMarket()
  const { data: feed } = useFeed()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navSlots =
    feed?.slots.filter((s) => s.presentationType === PRESENTATION_GRID_4 && s.displayName) ?? []

  const navLinks = [
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

  return (
    <header className="border-b border-neutral-200">
      <div className="bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-2">
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

        {mobileOpen ? (
          <nav
            id="mobile-nav"
            className="border-t border-neutral-200 bg-white px-6 py-3 md:hidden"
            aria-label="Mobile sections"
          >
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="block py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)]"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </header>
  )
}
