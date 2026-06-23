'use client'

import Image from 'next/image'
import type { IArticleDetail, IArticleMedia } from '@/interfaces/article'
import { isDataUri } from '@/lib/helpers/image-src'

const IMAGE_FILE_TYPE = 'image'

interface IArticleGalleryProps {
  article: IArticleDetail
  /** When true, the lead block already renders the hero image, so skip it here. */
  excludeHeroImage: boolean
  heading: string
}

/**
 * Select the image assets that should appear in the gallery.
 *
 * Excludes non-image media, and optionally the hero image already shown in the
 * lead media block, so the gallery only surfaces the *additional* pictures.
 *
 * @param article Full article detail with resolved media assets.
 * @param excludeHeroImage Whether to drop the image used as the lead hero.
 * @returns Ordered image assets to render in the gallery.
 */
function galleryImages(article: IArticleDetail, excludeHeroImage: boolean): IArticleMedia[] {
  const images = article.media.filter((asset) => asset.fileType === IMAGE_FILE_TYPE)
  if (!excludeHeroImage || !article.thumbnailUrl) {
    return images
  }

  let heroSkipped = false
  return images.filter((asset) => {
    if (!heroSkipped && asset.url === article.thumbnailUrl) {
      heroSkipped = true
      return false
    }
    return true
  })
}

/**
 * Render every additional uploaded picture for an article as a responsive grid.
 *
 * Returns an empty fragment when there are no extra images to show, so callers
 * can render it unconditionally.
 *
 * @param article Full article detail with resolved media assets.
 * @param excludeHeroImage Whether the lead block already shows the first image.
 * @param heading Localized section heading for the gallery.
 * @returns The gallery grid or an empty fragment.
 */
export function ArticleGallery({
  article,
  excludeHeroImage,
  heading,
}: IArticleGalleryProps): JSX.Element {
  const images = galleryImages(article, excludeHeroImage)

  if (images.length === 0) {
    return <></>
  }

  return (
    <section className="mb-6" aria-label={heading}>
      <h2 className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-neutral-500">
        {heading}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {images.map((image, index) => (
          <figure
            key={image.id || `${index}-${image.url}`}
            className="relative aspect-[4/3] overflow-hidden rounded border border-neutral-200 bg-neutral-100"
          >
            <Image
              src={image.url}
              alt={`${article.title} — image ${index + 1}`}
              fill
              className="object-cover"
              unoptimized={isDataUri(image.url)}
              sizes="(min-width: 640px) 50vw, 100vw"
            />
          </figure>
        ))}
      </div>
    </section>
  )
}
