'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { IArticleDetail, IArticleMedia } from '@/interfaces/article'
import { isDataUri } from '@/lib/helpers/image-src'

const IMAGE_FILE_TYPE = 'image'

interface IArticleGalleryProps {
  article: IArticleDetail
  /** When true, the lead block already renders the hero image, so skip it here. */
  excludeHeroImage: boolean
  /** Optional section heading; omit when the carousel is itself the lead media. */
  heading?: string
}

/**
 * Drop the hero image (already shown in the lead block) from the image list.
 *
 * @param images Ordered image assets.
 * @param thumbnailUrl URL of the hero image to remove once.
 * @returns Images without the first hero occurrence.
 */
function withoutHeroImage(images: IArticleMedia[], thumbnailUrl: string): IArticleMedia[] {
  let heroSkipped = false
  return images.filter((asset) => {
    if (!heroSkipped && asset.url === thumbnailUrl) {
      heroSkipped = true
      return false
    }
    return true
  })
}

/**
 * Move the hero image to the front so it becomes the carousel's first slide.
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
 * Select the image assets that should appear in the gallery.
 *
 * Excludes non-image media. When the lead block shows the hero separately the
 * hero is dropped; otherwise the hero is ordered first so the carousel starts on
 * the article's first picture.
 *
 * @param article Full article detail with resolved media assets.
 * @param excludeHeroImage Whether to drop the image used as the lead hero.
 * @returns Ordered image assets to render in the gallery.
 */
function galleryImages(article: IArticleDetail, excludeHeroImage: boolean): IArticleMedia[] {
  const images = article.media.filter((asset) => asset.fileType === IMAGE_FILE_TYPE)
  if (!article.thumbnailUrl) {
    return images
  }
  return excludeHeroImage
    ? withoutHeroImage(images, article.thumbnailUrl)
    : withHeroFirst(images, article.thumbnailUrl)
}

/**
 * Render every additional uploaded picture for an article as a single-image
 * carousel with previous/next navigation.
 *
 * Returns an empty fragment when there are no extra images to show, so callers
 * can render it unconditionally.
 *
 * @param article Full article detail with resolved media assets.
 * @param excludeHeroImage Whether the lead block already shows the first image.
 * @param heading Localized section heading for the gallery.
 * @returns The gallery carousel or an empty fragment.
 */
export function ArticleGallery({
  article,
  excludeHeroImage,
  heading,
}: IArticleGalleryProps): JSX.Element {
  const t = useTranslations('common')
  const images = galleryImages(article, excludeHeroImage)

  if (images.length === 0) {
    return <></>
  }

  return (
    <section className="mb-6" aria-label={heading ?? t('photoGallery')}>
      {heading ? (
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-neutral-500">
          {heading}
        </h2>
      ) : null}
      <GalleryCarousel images={images} title={article.title} />
    </section>
  )
}

interface IGalleryCarouselProps {
  images: IArticleMedia[]
  title: string
}

/**
 * Show one gallery image at a time with arrow controls to step through the set.
 *
 * Navigation wraps around both ends so readers can cycle continuously, and the
 * arrows/counter are hidden for single-image galleries where they add no value.
 *
 * @param images Ordered image assets to page through.
 * @param title Article title used to build descriptive alt text.
 * @returns The interactive single-image carousel.
 */
function GalleryCarousel({ images, title }: IGalleryCarouselProps): JSX.Element {
  const t = useTranslations('common')
  const [activeIndex, setActiveIndex] = useState(0)
  const total = images.length
  const hasMultiple = total > 1
  const activeImage = images[activeIndex]

  // Wrap with modulo so stepping past either end cycles to the other side.
  const goToOffset = (offset: number): void => {
    setActiveIndex((current) => (current + offset + total) % total)
  }

  return (
    <div>
      <figure className="relative aspect-[4/3] overflow-hidden rounded border border-neutral-200 bg-neutral-100">
        <Image
          src={activeImage.url}
          alt={`${title} — image ${activeIndex + 1}`}
          fill
          className="object-cover"
          unoptimized={isDataUri(activeImage.url)}
          sizes="(min-width: 640px) 50vw, 100vw"
        />
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
