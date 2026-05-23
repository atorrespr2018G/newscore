import Image from 'next/image'
import type { IArticle } from '@/interfaces/article'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'

/** Matches one cell in the hero sub-story strip (md:grid-cols-3 under the lead). */
export const HERO_STRIP_THUMB_WIDTH_CLASS =
  'w-[calc(((min(72rem,100vw)-3rem-22rem)/12*6+10rem)-2rem)/3)]'

interface IHomepageStoryThumbProps {
  article: IArticle
  className?: string
}

/**
 * Shared 16:10 story thumbnail (hero right rail, editorial third column, etc.).
 */
export function HomepageStoryThumb({ article, className }: IHomepageStoryThumbProps): JSX.Element {
  return (
    <div
      className={[
        'overflow-hidden rounded border border-neutral-200 bg-neutral-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="relative aspect-[16/10] w-full">
        <Image
          src={article.thumbnailUrl ?? placeholderImageDataUri(article.slug)}
          alt=""
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    </div>
  )
}
