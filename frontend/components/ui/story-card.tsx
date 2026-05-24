import Image from 'next/image'
import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'

export type StoryCardVariant = 'hero-lead' | 'compact' | 'headline-only' | 'rail' | 'grid'

export interface IStoryCardProps {
  article: IArticle
  variant?: StoryCardVariant
  kicker?: string
  layout?: 'side' | 'stacked'
  dense?: boolean
  compact?: boolean
  showAuthor?: boolean
  className?: string
}

const titleHover = 'group-hover:text-brand'

export function StoryCard({
  article,
  variant = 'grid',
  kicker,
  layout = 'side',
  dense = false,
  compact = false,
  showAuthor = false,
  className,
}: IStoryCardProps): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`
  const imgSrc = articleImageSrc(article)
  const unoptimized = isDataUri(imgSrc)

  if (variant === 'headline-only') {
    return (
      <li className={className}>
        <Link
          href={href}
          className={[
            'group block text-[14px] font-extrabold leading-snug text-neutral-950 hover:text-brand',
            compact ? '' : 'py-3',
          ].join(' ')}
        >
          {article.title}
        </Link>
      </li>
    )
  }

  if (variant === 'compact') {
    return (
      <article className={['group', className].filter(Boolean).join(' ')}>
        <Link
          href={href}
          className={layout === 'side' ? 'grid grid-cols-[112px_1fr] items-stretch gap-3' : 'block'}
        >
          <StoryThumb
            src={imgSrc}
            alt={article.title}
            unoptimized={unoptimized}
            aspect={layout === 'side' ? '4/3' : '16/10'}
            className={layout === 'side' ? 'shrink-0 border-0' : 'w-full'}
          />
          <StoryTitle
            title={article.title}
            kicker={kicker}
            dense
            className={layout === 'side' ? 'flex min-w-0 items-center py-3 pr-3' : 'mt-3'}
            as="p"
          />
        </Link>
      </article>
    )
  }

  if (variant === 'rail') {
    return (
      <article className={['group', className].filter(Boolean).join(' ')}>
        <Link href={href} className="block">
          <StoryThumb src={imgSrc} alt={article.title} unoptimized={unoptimized} hoverScale />
          <StoryTitle title={article.title} kicker={kicker} dense className="mt-2" />
        </Link>
      </article>
    )
  }

  if (variant === 'hero-lead') {
    return (
      <article
        className={[
          'border-b border-neutral-200 pb-4 last:border-b-0 last:pb-0',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Link
          href={href}
          className={layout === 'side' ? 'group grid grid-cols-[160px_1fr] gap-4' : 'group block'}
        >
          <StoryThumb
            src={imgSrc}
            alt={article.title}
            unoptimized={unoptimized}
            aspect={layout === 'side' ? '4/3' : '16/10'}
          />
          <StoryTitle
            title={article.title}
            kicker={kicker}
            dense={dense}
            className={layout === 'side' ? '' : 'mt-3'}
          />
        </Link>
      </article>
    )
  }

  return (
    <article className={['group', className].filter(Boolean).join(' ')}>
      <Link href={href} className="block">
        <StoryThumb src={imgSrc} alt={article.title} unoptimized={unoptimized} hoverScale />
        <StoryTitle title={article.title} dense className="mt-3" />
        {showAuthor ? (
          <p className="mt-1 text-xs font-semibold text-neutral-600">{article.authorName}</p>
        ) : null}
      </Link>
    </article>
  )
}

interface IStoryThumbProps {
  src: string
  alt: string
  unoptimized: boolean
  aspect?: '4/3' | '16/10' | '16/9'
  className?: string
  hoverScale?: boolean
}

function StoryThumb({
  src,
  alt,
  unoptimized,
  aspect = '16/10',
  className,
  hoverScale = false,
}: IStoryThumbProps): JSX.Element {
  const aspectClass =
    aspect === '4/3' ? 'aspect-[4/3]' : aspect === '16/9' ? 'aspect-[16/9]' : 'aspect-[16/10]'

  return (
    <div
      className={[
        'overflow-hidden rounded border border-neutral-200 bg-neutral-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={['relative w-full', aspectClass].join(' ')}>
        <Image
          src={src}
          alt={alt}
          fill
          className={[
            'object-cover',
            hoverScale ? 'transition-transform duration-200 group-hover:scale-[1.02]' : '',
          ].join(' ')}
          unoptimized={unoptimized}
        />
      </div>
    </div>
  )
}

interface IStoryTitleProps {
  title: string
  kicker?: string
  dense?: boolean
  className?: string
  as?: 'h3' | 'p'
}

function StoryTitle({ title, kicker, dense = false, className, as: Tag = 'h3' }: IStoryTitleProps): JSX.Element {
  return (
    <div className={className}>
      {kicker ? (
        <p className="text-[11px] font-extrabold tracking-[0.22em] text-brand">{kicker}</p>
      ) : null}
      <Tag
        className={[
          'mt-1 leading-snug text-neutral-950',
          titleHover,
          dense ? 'text-[13px] font-extrabold' : 'text-[15px] font-extrabold',
        ].join(' ')}
      >
        {title}
      </Tag>
    </div>
  )
}
