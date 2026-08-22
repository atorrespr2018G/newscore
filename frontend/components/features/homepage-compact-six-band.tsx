'use client'

import { useEffect, useState } from 'react'
import type { IFeedSlot } from '@/interfaces/feed'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { ArchiveSectionLink } from '@/components/ui/archive-section-link'
import { PlacementSlotScope, useEditorPlacement } from '@/context/editor-placement-context'
import { PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useMarket } from '@/context/market-context'
import { useSectionLabels } from '@/hooks/use-section-labels'
import {
  COMPACT_SIX_BAND_ARTICLE_LIMIT,
  homepageSectionLandingHref,
  sectionAnchorId,
} from '@/lib/helpers/section-labels'
import { businessArchiveHref } from '@/lib/helpers/business-archive'
import { entertainmentArchiveHref } from '@/lib/helpers/entertainment-archive'
import { governmentArchiveHref } from '@/lib/helpers/government-archive'
import { healthArchiveHref } from '@/lib/helpers/health-archive'
import { customTabTopicPath } from '@/lib/helpers/custom-tab-archive'
import { sportArchiveHref } from '@/lib/helpers/sport-archive'
import { worldArchiveHref } from '@/lib/helpers/world-archive'
import { toRegionCode } from '@/lib/region-code'
import { useTranslations } from 'next-intl'

const MOBILE_ARTICLES_PER_PAGE = 2
const TABLET_ARTICLES_PER_PAGE = 3
const DESKTOP_BREAKPOINT = 1024
const TABLET_BREAKPOINT = 640

function articlesPerPageForWidth(width: number): number {
  if (width >= DESKTOP_BREAKPOINT) {
    return COMPACT_SIX_BAND_ARTICLE_LIMIT
  }
  if (width >= TABLET_BREAKPOINT) {
    return TABLET_ARTICLES_PER_PAGE
  }
  return MOBILE_ARTICLES_PER_PAGE
}

interface IHomepageCompactSixBandProps {
  slot: IFeedSlot
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
}

/**
 * Netflix-style carousel: shows 6 cards at a time, arrow overlays the last card,
 * vertically centered, only visible on row hover. Slides via CSS translateX.
 */
export function HomepageCompactSixBand({ slot, pageName }: IHomepageCompactSixBandProps): JSX.Element | null {
  const { homepageSectionTitle } = useSectionLabels(pageName)
  const { marketCode, town, county } = useMarket()
  const regionScopeKey = toRegionCode(marketCode, town, county)
  const t = useTranslations('common')
  const editor = useEditorPlacement()
  const allArticles = slot.articles
  const [articlesPerPage, setArticlesPerPage] = useState(COMPACT_SIX_BAND_ARTICLE_LIMIT)
  const totalPages = Math.ceil(allArticles.length / articlesPerPage) || 1
  const isPaginated = totalPages > 1

  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [regionScopeKey])

  useEffect(() => {
    const syncArticlesPerPage = (): void => {
      setArticlesPerPage(articlesPerPageForWidth(window.innerWidth))
    }

    syncArticlesPerPage()
    window.addEventListener('resize', syncArticlesPerPage)
    return () => window.removeEventListener('resize', syncArticlesPerPage)
  }, [])

  useEffect(() => {
    if (page >= totalPages) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages])

  if (allArticles.length === 0 && editor == null) {
    return null
  }

  const title = homepageSectionTitle(slot.positionKey, slot.displayName)
  const anchorId = sectionAnchorId(slot.positionKey)
  const archiveHref =
    sportArchiveHref(pageName, slot.positionKey) ??
    worldArchiveHref(pageName, slot.positionKey) ??
    businessArchiveHref(pageName, slot.positionKey) ??
    governmentArchiveHref(pageName, slot.positionKey) ??
    entertainmentArchiveHref(pageName, slot.positionKey) ??
    healthArchiveHref(pageName, slot.positionKey) ??
    (pageName &&
    ![
      'homepage',
      'world',
      'sports',
      'government',
      'business',
      'technology',
      'entertainment',
      'health',
      'politics',
    ].includes(pageName.trim().toLowerCase())
      ? customTabTopicPath(pageName, slot.positionKey)
      : null) ??
    homepageSectionLandingHref(pageName, slot.positionKey)

  return (
    <PlacementSlotScope slotId={slot.id}>
      <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
        <CompactSixBandHeading title={title} latestLabel={t('latest')} href={archiveHref} />

        {allArticles.length === 0 ? null : isPaginated ? (
          <div className="group/row relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-700 ease-in-out"
                style={{ transform: `translateX(-${page * 100}%)` }}
              >
                {Array.from({ length: totalPages }).map((_, pageIndex) => (
                  <div key={pageIndex} className="w-full flex-shrink-0">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
                      {allArticles
                        .slice(
                          pageIndex * articlesPerPage,
                          (pageIndex + 1) * articlesPerPage,
                        )
                        .map((article) => (
                          <HomepageStoryCard
                            key={article.id}
                            article={article}
                            variant="grid"
                            plainTitle
                            titleClassName="text-[13px]"
                            editorDroppable
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {page > 0 && (
              <SliderHandle
                direction="left"
                label={t('previous')}
                onClick={() => setPage((p) => p - 1)}
              />
            )}
            {page < totalPages - 1 && (
              <SliderHandle
                direction="right"
                label={t('next')}
                onClick={() => setPage((p) => p + 1)}
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
            {allArticles.slice(0, articlesPerPage).map((article) => (
              <HomepageStoryCard
                key={article.id}
                article={article}
                variant="grid"
                plainTitle
                titleClassName="text-[13px]"
                editorDroppable
              />
            ))}
          </div>
        )}
        <PlacementSectionDropZone />
      </section>
    </PlacementSlotScope>
  )
}

interface ICompactSixBandHeadingProps {
  title: string
  latestLabel: string
  href: string | null
}

/**
 * Compact-band section title. Homepage Sports/World/Business open those landings.
 *
 * @param props Heading copy, latest label, and optional archive href.
 * @returns Section heading row.
 */
function CompactSixBandHeading({ title, latestLabel, href }: ICompactSixBandHeadingProps): JSX.Element {
  const latestClassName = 'text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500'
  const titleClassName = 'text-2xl font-normal tracking-tight text-neutral-950'

  return (
    <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
      <h2 className={titleClassName}>
        {href ? (
          <ArchiveSectionLink href={href} className="hover:underline">
            {title}
          </ArchiveSectionLink>
        ) : (
          title
        )}
      </h2>
      {href ? (
        <ArchiveSectionLink href={href} className={`${latestClassName} hover:underline`}>
          {latestLabel}
        </ArchiveSectionLink>
      ) : (
        <span className={latestClassName}>{latestLabel}</span>
      )}
    </div>
  )
}

interface ISliderHandleProps {
  direction: 'left' | 'right'
  label: string
  onClick: () => void
}

/**
 * Netflix-style handle: vertically centered chevron overlaying the last/first card.
 * No background, no shadow — just the arrow. Only appears on row hover.
 */
function SliderHandle({ direction, label, onClick }: ISliderHandleProps): JSX.Element {
  const isLeft = direction === 'left'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'absolute top-[33%] z-10 -translate-y-1/2',
        'opacity-0 transition-opacity duration-200 group-hover/row:opacity-100',
        'focus-visible:opacity-100 focus-visible:outline-none',
        isLeft ? 'left-2' : 'right-2',
      ].join(' ')}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-8 w-8 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        fill="none"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        {isLeft ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        )}
      </svg>
    </button>
  )
}
