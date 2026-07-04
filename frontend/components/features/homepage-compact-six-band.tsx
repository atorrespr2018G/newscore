'use client'

import { useState } from 'react'
import type { IFeedSlot } from '@/interfaces/feed'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { COMPACT_SIX_BAND_ARTICLE_LIMIT, sectionAnchorId } from '@/lib/helpers/section-labels'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('common')
  const allArticles = slot.articles
  const totalPages = Math.ceil(allArticles.length / COMPACT_SIX_BAND_ARTICLE_LIMIT)
  const isPaginated = totalPages > 1

  const [page, setPage] = useState(0)

  if (allArticles.length === 0) {
    return null
  }

  const title = homepageSectionTitle(slot.positionKey, slot.displayName)
  const anchorId = sectionAnchorId(slot.positionKey)

  return (
    <PlacementSlotScope slotId={slot.id}>
      <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
        <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
          <h2 className="text-2xl font-normal tracking-tight text-neutral-950">{title}</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{t('latest')}</span>
        </div>

        {isPaginated ? (
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
                          pageIndex * COMPACT_SIX_BAND_ARTICLE_LIMIT,
                          (pageIndex + 1) * COMPACT_SIX_BAND_ARTICLE_LIMIT,
                        )
                        .map((article) => (
                          <HomepageStoryCard
                            key={article.id}
                            article={article}
                            variant="grid"
                            plainTitle
                            titleClassName="text-[13px]"
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
            {allArticles.slice(0, COMPACT_SIX_BAND_ARTICLE_LIMIT).map((article) => (
              <HomepageStoryCard
                key={article.id}
                article={article}
                variant="grid"
                plainTitle
                titleClassName="text-[13px]"
              />
            ))}
          </div>
        )}
        <PlacementSectionDropZone />
      </section>
    </PlacementSlotScope>
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
