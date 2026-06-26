'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { IArticleDetail, IArticleMedia } from '@/interfaces/article'
import { isDataUri } from '@/lib/helpers/image-src'

const IMAGE_FILE_TYPE = 'image'
const VIDEO_FILE_TYPE = 'video'

/** A single navigable carousel slide, either a picture or a video. */
type GalleryMediaType = 'image' | 'video'

interface IGallerySlide {
  type: GalleryMediaType
  url: string
}

interface IArticleGalleryProps {
  article: IArticleDetail
}

/**
 * Move the hero image to the front so it becomes the first picture slide.
 *
 * @param images Ordered image assets.
 * @param thumbnailUrl URL of the hero image to surface first.
 * @returns Images with the hero positioned first.
 */
function withHeroFirst(images: IArticleMedia[], thumbnailUrl: string): IArticleMedia[] {
  const heroIndex = images.findIndex((asset) => asset.url === thumbnailUrl)
  if (heroIndex <= 0) {
    return images
  }
  const hero = images[heroIndex]
  return [hero, ...images.slice(0, heroIndex), ...images.slice(heroIndex + 1)]
}

/**
 * Collect the article's video URLs, lead video first, de-duplicated by URL.
 *
 * The lead `videoUrl` is stored separately from `media`, so it is surfaced
 * first to preserve the historical "video above the photos" ordering; any
 * video assets that also live in `media` are appended without duplication.
 *
 * @param article Full article detail with resolved media assets.
 * @returns Ordered, unique video URLs to render before the pictures.
 */
function galleryVideoUrls(article: IArticleDetail): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  const leadVideo = article.videoUrl?.trim()
  if (leadVideo) {
    urls.push(leadVideo)
    seen.add(leadVideo)
  }
  for (const asset of article.media) {
    if (asset.fileType === VIDEO_FILE_TYPE && asset.url && !seen.has(asset.url)) {
      urls.push(asset.url)
      seen.add(asset.url)
    }
  }
  return urls
}

/**
 * Build the ordered slides for the unified media carousel.
 *
 * Videos come first (matching the legacy lead-video placement), followed by
 * the pictures with the hero image surfaced first.
 *
 * @param article Full article detail with resolved media assets.
 * @returns Ordered slides combining the article's videos and pictures.
 */
function gallerySlides(article: IArticleDetail): IGallerySlide[] {
  const images = article.media.filter((asset) => asset.fileType === IMAGE_FILE_TYPE)
  const orderedImages = article.thumbnailUrl
    ? withHeroFirst(images, article.thumbnailUrl)
    : images
  const videoSlides: IGallerySlide[] = galleryVideoUrls(article).map((url) => ({
    type: 'video',
    url,
  }))
  const imageSlides: IGallerySlide[] = orderedImages.map((asset) => ({
    type: 'image',
    url: asset.url,
  }))
  return [...videoSlides, ...imageSlides]
}

/**
 * Render an article's pictures and video as a single carousel with
 * previous/next navigation.
 *
 * Returns an empty fragment when there is no media to show, so callers can
 * render it unconditionally.
 *
 * @param article Full article detail with resolved media assets.
 * @returns The gallery carousel or an empty fragment.
 */
export function ArticleGallery({ article }: IArticleGalleryProps): JSX.Element {
  const t = useTranslations('common')
  const slides = gallerySlides(article)

  if (slides.length === 0) {
    return <></>
  }

  return (
    <section className="mb-6" aria-label={t('photoGallery')}>
      <GalleryCarousel slides={slides} title={article.title} />
    </section>
  )
}

interface IGalleryCarouselProps {
  slides: IGallerySlide[]
  title: string
}

/**
 * Show one media slide at a time with arrow controls to step through the set.
 *
 * Navigation wraps around both ends so readers can cycle continuously, and the
 * arrows/counter are hidden for single-slide galleries where they add no value.
 * Only the active slide is mounted, so navigating away from a video unmounts it
 * and stops playback.
 *
 * @param slides Ordered media slides (pictures and videos) to page through.
 * @param title Article title used to build descriptive alt/labels.
 * @returns The interactive single-slide carousel.
 */
function GalleryCarousel({ slides, title }: IGalleryCarouselProps): JSX.Element {
  const t = useTranslations('common')
  const [activeIndex, setActiveIndex] = useState(0)
  const total = slides.length
  const hasMultiple = total > 1
  const activeSlide = slides[activeIndex]

  // Wrap with modulo so stepping past either end cycles to the other side.
  const goToOffset = (offset: number): void => {
    setActiveIndex((current) => (current + offset + total) % total)
  }

  return (
    <div>
      <figure className="relative aspect-[4/3] overflow-hidden rounded border border-neutral-200 bg-neutral-100">
        {activeSlide.type === 'video' ? (
          <video
            // Seek to the first frame so the slide shows a preview before playback.
            src={`${activeSlide.url}#t=0.1`}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full bg-black object-contain"
            aria-label={`${title} — video ${activeIndex + 1}`}
          />
        ) : (
          <Image
            src={activeSlide.url}
            alt={`${title} — image ${activeIndex + 1}`}
            fill
            className="object-cover"
            unoptimized={isDataUri(activeSlide.url)}
            sizes="(min-width: 640px) 50vw, 100vw"
          />
        )}
        {hasMultiple ? (
          <>
            <GalleryArrow direction="previous" label={t('previousPhoto')} onClick={() => goToOffset(-1)} />
            <GalleryArrow direction="next" label={t('nextPhoto')} onClick={() => goToOffset(1)} />
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
              {t('photoCounter', { current: activeIndex + 1, total })}
            </span>
          </>
        ) : null}
      </figure>
      {hasMultiple ? (
        <GalleryDots
          count={total}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          buildLabel={(position) => t('goToPhoto', { position })}
        />
      ) : null}
    </div>
  )
}

interface IGalleryArrowProps {
  direction: 'previous' | 'next'
  label: string
  onClick: () => void
}

/**
 * Render a circular navigation arrow pinned to one side of the carousel.
 *
 * @param direction Which edge the arrow sits on and which way it points.
 * @param label Accessible label announced to assistive technology.
 * @param onClick Handler advancing the carousel in this direction.
 * @returns The positioned arrow button.
 */
function GalleryArrow({ direction, label, onClick }: IGalleryArrowProps): JSX.Element {
  const isPrevious = direction === 'previous'
  const sideClass = isPrevious ? 'left-2' : 'right-2'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 ${sideClass} flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points={isPrevious ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
      </svg>
    </button>
  )
}

interface IGalleryDotsProps {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
  buildLabel: (position: number) => string
}

/**
 * Render clickable position indicators for jumping directly to any image.
 *
 * @param count Total number of images in the carousel.
 * @param activeIndex Currently displayed image index.
 * @param onSelect Handler selecting an image by index.
 * @param buildLabel Builds the accessible label for a one-based position.
 * @returns The row of position dots.
 */
function GalleryDots({ count, activeIndex, onSelect, buildLabel }: IGalleryDotsProps): JSX.Element {
  return (
    <div className="mt-3 flex justify-center gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={buildLabel(index + 1)}
          aria-current={index === activeIndex}
          className={`h-2 w-2 rounded-full transition ${
            index === activeIndex ? 'bg-brand' : 'bg-neutral-300 hover:bg-neutral-400'
          }`}
        />
      ))}
    </div>
  )
}
