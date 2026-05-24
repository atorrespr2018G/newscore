import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import Image from 'next/image'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'

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
  const imgSrc = articleImageSrc(article)

  return (
    <article className="border-b border-neutral-200 py-4 last:border-b-0">
      <Link href={`/article/${encodeURIComponent(article.slug)}`} className="block">
        {variant === 'standard' ? (
          <div className="mb-3 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
            <div className="relative aspect-[16/9]">
              <Image src={imgSrc} alt={article.title} fill className="object-cover" unoptimized={isDataUri(imgSrc)} />
            </div>
          </div>
        ) : null}
        <h3
          className={[
            'leading-snug text-neutral-950 hover:text-brand',
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
