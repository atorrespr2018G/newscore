'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { ArticleLeadMedia } from '@/components/ui/article-lead-media'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { PlacementOverlay, PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useMarket } from '@/context/market-context'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { sectionAnchorId } from '@/lib/helpers/section-labels'
import { toRegionCode } from '@/lib/region-code'
import { useTranslations } from 'next-intl'

interface IHealthCarouselSectionProps {
  slot: IFeedSlot
}

const HEALTH_CAROUSEL_VIDEO_COUNT = 20
/** Thumbnail cards use ~25% track width on large screens, so four fit in the viewport at once. */
const HEALTH_CAROUSEL_VISIBLE_COUNT = 4

function estimatedReadMinutes(article: IArticle): number {
  const wordCount = (article.summary ?? article.title).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

function formatReadTime(article: IArticle, readTimeLabel: (values: { minutes: number }) => string): string {
  const minutes = estimatedReadMinutes(article)
  return readTimeLabel({ minutes })
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5 stroke-current"
      fill="none"
      strokeWidth="2"
    >
      {direction === 'left' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      )}
    </svg>
  )
}

/**
 * CNN-style health module: featured hero on top, dark thumbnail carousel below.
 */
export function HealthCarouselSection({ slot }: IHealthCarouselSectionProps): JSX.Element | null {
  const { homepageSectionTitle } = useSectionLabels()
  const { marketCode, town, county } = useMarket()
  const regionScopeKey = toRegionCode(marketCode, town, county)
  const t = useTranslations('common')
  const tHome = useTranslations('home')
  const articles = slot.articles.slice(0, HEALTH_CAROUSEL_VIDEO_COUNT)
  const [activeIndex, setActiveIndex] = useState(0)
  const [playbackNonce, setPlaybackNonce] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveIndex(0)
    setPlaybackNonce(0)
    trackRef.current?.scrollTo({ left: 0 })
  }, [regionScopeKey])

  const selectArticle = useCallback((index: number) => {
    setActiveIndex(index)
    setPlaybackNonce((current) => current + 1)
  }, [])

  const scrollCarousel = useCallback((direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) {
      return
    }
    const card = track.querySelector<HTMLElement>('[data-carousel-card]')
    const gap = 12
    const cardStep = card ? card.offsetWidth + gap : track.clientWidth / HEALTH_CAROUSEL_VISIBLE_COUNT
    const step = cardStep * HEALTH_CAROUSEL_VISIBLE_COUNT
    const maxScrollLeft = track.scrollWidth - track.clientWidth
    const nextScrollLeft = Math.max(0, Math.min(track.scrollLeft + direction * step, maxScrollLeft))
    track.scrollTo({ left: nextScrollLeft, behavior: 'smooth' })
  }, [])

  if (articles.length === 0) {
    return null
  }

  const activeArticle = articles[activeIndex] ?? articles[0]
  const title = homepageSectionTitle(slot.positionKey, slot.displayName)
  const anchorId = sectionAnchorId(slot.positionKey)

  return (
    <PlacementSlotScope slotId={slot.id}>
    <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
      <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
        <h2 className="text-2xl font-black tracking-tight text-neutral-950">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{t('latest')}</span>
      </div>

      <div>
        <div className="mx-auto w-[68%] max-w-full">
          <HealthCarouselHeroVideo
            article={activeArticle}
            autoPlayUnmuted={playbackNonce > 0}
            playbackNonce={playbackNonce}
          />
        </div>

        <div className="overflow-hidden rounded border border-neutral-200">
          <div className="relative bg-[#1a1a1a]">
            <div className="flex items-stretch">
            <CarouselNavButton
              direction="left"
              label={tHome('healthCarousel.scrollLeft')}
              onClick={() => scrollCarousel(-1)}
            />

            <HealthCarouselAdScreen />

            <div
              ref={trackRef}
              className="flex min-w-0 flex-1 gap-3 overflow-x-auto scroll-smooth px-1 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {articles.map((article, index) => (
                <HealthCarouselCard
                  key={article.id}
                  article={article}
                  isActive={index === activeIndex}
                  onSelect={() => selectArticle(index)}
                />
              ))}
            </div>

            <CarouselNavButton
              direction="right"
              label={tHome('healthCarousel.scrollRight')}
              onClick={() => scrollCarousel(1)}
            />
            </div>
          </div>
        </div>
      </div>
      <PlacementSectionDropZone />
    </section>
    </PlacementSlotScope>
  )
}

interface IHealthCarouselHeroVideoProps {
  article: IArticle
  autoPlayUnmuted: boolean
  playbackNonce: number
}

function HealthCarouselHeroVideo({
  article,
  autoPlayUnmuted,
  playbackNonce,
}: IHealthCarouselHeroVideoProps): JSX.Element {
  return (
    <PlacementOverlay article={article}>
      <div className="relative aspect-video w-full bg-black">
        <ArticleLeadMedia
          article={article}
          mode="full"
          autoPlayUnmuted={autoPlayUnmuted}
          playbackNonce={playbackNonce}
          priority
          imageSizes="(max-width: 1024px) 68vw, 697px"
        />
      </div>
    </PlacementOverlay>
  )
}

interface ICarouselNavButtonProps {
  direction: 'left' | 'right'
  label: string
  onClick: () => void
}

function HealthCarouselAdScreen(): JSX.Element {
  const t = useTranslations('common')

  return (
    <div
      className="my-4 ml-1 w-[min(72vw,220px)] shrink-0 border border-neutral-600 bg-neutral-800 sm:w-[200px] lg:my-4 lg:w-[calc(25%-12px)] lg:min-w-[180px]"
      role="img"
      aria-label={t('advertisement')}
    >
      <div className="relative flex aspect-video w-full items-center justify-center px-4">
        <span className="text-[11px] font-black tracking-[0.28em] text-neutral-400">{t('advertisement').toUpperCase()}</span>
      </div>
    </div>
  )
}

function CarouselNavButton({ direction, label, onClick }: ICarouselNavButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex w-10 shrink-0 items-center justify-center text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] sm:w-12"
    >
      <ChevronIcon direction={direction} />
    </button>
  )
}

interface IHealthCarouselCardProps {
  article: IArticle
  isActive: boolean
  onSelect: () => void
}

function HealthCarouselCardPreview({ article }: { article: IArticle }): JSX.Element {
  return (
    <ArticleLeadMedia
      article={article}
      mode="preview-frame"
      className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
      imageSizes="220px"
    />
  )
}

function HealthCarouselCard({ article, isActive, onSelect }: IHealthCarouselCardProps): JSX.Element {
  const t = useTranslations('common')

  return (
    <article
      data-carousel-card
      className="w-[min(72vw,220px)] shrink-0 sm:w-[200px] lg:w-[calc(25%-12px)] lg:min-w-[180px]"
    >
      <PlacementOverlay article={article}>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]',
          isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100',
        ].join(' ')}
        aria-pressed={isActive}
        aria-label={isActive ? `Showing: ${article.title}` : article.title}
      >
        <div className="relative aspect-video overflow-hidden bg-neutral-800">
          <HealthCarouselCardPreview article={article} />

          {isActive ? (
            <span className="absolute left-0 top-0 bg-black px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              Showing
            </span>
          ) : null}

          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            <span aria-hidden className="text-[10px]">
              ◷
            </span>
            {formatReadTime(article, (values) => t('readTime', values))}
          </span>
        </div>

        <p className="mt-2 line-clamp-3 overflow-hidden px-0.5 font-sans text-[13px] font-normal leading-snug text-white group-hover:text-white/90">
          {article.title}
        </p>
      </button>
      </PlacementOverlay>
    </article>
  )
}
