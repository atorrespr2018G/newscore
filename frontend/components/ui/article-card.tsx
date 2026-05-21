import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import Image from 'next/image'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'

interface IArticleCardProps {
  article: IArticle
  variant?: 'standard' | 'compact'
}

/**
 * Presentational card for a single article.
 * No data fetching — all data via props.
 */
export function ArticleCard({ article, variant = 'standard' }: IArticleCardProps): JSX.Element {
  const date = new Date(article.publishedAt ?? article.createdAt).toLocaleString()
  const imgSrc = article.thumbnailUrl ?? placeholderImageDataUri(article.slug)

  return (
    <article
      className={[
        'border-b border-neutral-200 py-4',
        variant === 'standard' ? 'last:border-b-0' : 'last:border-b-0',
      ].join(' ')}
    >
      <Link href={`/article/${encodeURIComponent(article.slug)}`} className="block">
        {variant === 'standard' ? (
          <div className="mb-3 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
            <div className="relative aspect-[16/9]">
              <Image src={imgSrc} alt="" fill className="object-cover" unoptimized />
            </div>
          </div>
        ) : null}
        <h3
          className={[
            'leading-snug text-neutral-950 hover:text-[color:var(--brand-red)]',
            variant === 'compact' ? 'text-base font-semibold' : 'text-lg font-extrabold',
          ].join(' ')}
        >
          {article.title}
        </h3>
        <p className="mt-2 text-xs font-semibold text-neutral-600">
          {article.authorName} <span className="font-normal text-neutral-400">• {date}</span>
        </p>
      </Link>
    </article>
  )
}

