import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'
import {
  belowMediaTextClass,
  deckBelowTitle,
  textLinkDisplayText,
} from '@/lib/helpers/text-helpers'

export type StoryCardVariant = 'hero-lead' | 'compact' | 'headline-only' | 'rail' | 'grid' | 'text-link'

export const COMPACT_SIDE_THUMB_WIDTH = 112
export const COMPACT_SIDE_THUMB_HEIGHT = 84

export interface IStoryCardProps {
  article: IArticle
  variant?: StoryCardVariant
  kicker?: string
  layout?: 'side' | 'stacked'
  dense?: boolean
  compact?: boolean
  showAuthor?: boolean
  titleFirst?: boolean
  showSummary?: boolean
  /** Compact side layout thumb width in px (height defaults to 84px). */
  sideThumbWidth?: number
  /** Compact side layout thumb height in px (only used when sideThumbWidth is set). */
  sideThumbHeight?: number
  className?: string
  titleClassName?: string
  summaryClassName?: string
  /** Render headline copy at normal weight instead of the default bold styles. */
  plainTitle?: boolean
  /** Underline titles on hover instead of the default brand color (homepage). */
  underlineOnHover?: boolean
}

const TITLE_HOVER_BRAND = 'group-hover:text-brand'
const TITLE_HOVER_UNDERLINE = 'group-hover:underline'
const HEADLINE_LINK_HOVER_BRAND =
  'group block text-[14px] font-extrabold leading-snug text-neutral-950 hover:text-brand'
const HEADLINE_LINK_HOVER_UNDERLINE =
  'group block text-[14px] font-extrabold leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'
const PLAIN_HEADLINE_LINK_HOVER_BRAND =
  'group block font-sans text-[14px] font-normal leading-snug text-neutral-950 hover:text-brand'
const PLAIN_HEADLINE_LINK_HOVER_UNDERLINE =
  'group block font-sans text-[14px] font-normal leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'
const TEXT_LINK_HOVER_BRAND =
  'group block text-[15px] font-extrabold leading-snug text-neutral-950 hover:text-brand'
const TEXT_LINK_HOVER_UNDERLINE =
  'group block text-[15px] font-extrabold leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'
const PLAIN_TEXT_LINK_HOVER_BRAND =
  'group block font-sans text-[15px] font-normal leading-snug text-neutral-950 hover:text-brand'
const PLAIN_TEXT_LINK_HOVER_UNDERLINE =
  'group block font-sans text-[15px] font-normal leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'

function titleHoverClass(underlineOnHover: boolean): string {
  return underlineOnHover ? TITLE_HOVER_UNDERLINE : TITLE_HOVER_BRAND
}

function headlineOnlyLinkClass(plainTitle: boolean, underlineOnHover: boolean): string {
  if (plainTitle) {
    return underlineOnHover ? PLAIN_HEADLINE_LINK_HOVER_UNDERLINE : PLAIN_HEADLINE_LINK_HOVER_BRAND
  }

  return underlineOnHover ? HEADLINE_LINK_HOVER_UNDERLINE : HEADLINE_LINK_HOVER_BRAND
}

function textLinkClass(plainTitle: boolean, underlineOnHover: boolean): string {
  if (plainTitle) {
    return underlineOnHover ? PLAIN_TEXT_LINK_HOVER_UNDERLINE : PLAIN_TEXT_LINK_HOVER_BRAND
  }

  return underlineOnHover ? TEXT_LINK_HOVER_UNDERLINE : TEXT_LINK_HOVER_BRAND
}
const COMPACT_SIDE_TITLE_CLASS = 'text-[16px] font-extrabold'
const PLAIN_COMPACT_SIDE_TITLE_CLASS = 'text-[16px] font-normal'
const DEFAULT_TITLE_CLASS = 'text-[15px] font-extrabold'
const PLAIN_DEFAULT_TITLE_CLASS = 'text-[15px] font-normal'

function showsSummaryBelowMedia(
  variant: StoryCardVariant,
  layout: 'side' | 'stacked',
  showSummary: boolean,
): boolean {
  if (!showSummary) {
    return false
  }

  if (variant === 'compact' || variant === 'hero-lead') {
    return layout === 'stacked'
  }

  return variant === 'rail' || variant === 'grid'
}

export function StoryCard({
  article,
  variant = 'grid',
  kicker,
  layout = 'side',
  dense = false,
  compact = false,
  showAuthor = false,
  titleFirst = false,
  showSummary,
  sideThumbWidth,
  sideThumbHeight,
  className,
  titleClassName,
  summaryClassName,
  plainTitle = false,
  underlineOnHover = false,
}: IStoryCardProps): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`
  const imgSrc = articleImageSrc(article)
  const unoptimized = isDataUri(imgSrc)
  const displaySummary = showSummary ?? titleFirst
  const summary = showsSummaryBelowMedia(variant, layout, displaySummary)
    ? deckBelowTitle(article.title, article.summary, 200)
    : null
  const belowMediaTitleClass = belowMediaTextClass(titleClassName)
  const belowMediaSummaryClass = belowMediaTextClass(summaryClassName)

  if (variant === 'headline-only') {
    return (
      <li className={className}>
        <Link
          href={href}
          className={[
            headlineOnlyLinkClass(plainTitle, underlineOnHover),
            compact ? '' : 'py-3',
          ].join(' ')}
        >
          <span className={belowMediaTextClass(titleClassName)}>{article.title}</span>
        </Link>
      </li>
    )
  }

  if (variant === 'text-link') {
    return (
      <article className={className}>
        <Link
          href={href}
          className={textLinkClass(plainTitle, underlineOnHover)}
        >
          <span
            className={[
              'block min-h-[calc(1em*1.375*3)] overflow-hidden leading-snug',
              belowMediaTextClass(titleClassName),
              titleClassName ?? '',
            ].join(' ')}
          >
            {textLinkDisplayText(article)}
          </span>
        </Link>
      </article>
    )
  }

  if (variant === 'compact') {
    const titleBelowMedia = layout === 'stacked'
    const compactSideWidth = sideThumbWidth ?? COMPACT_SIDE_THUMB_WIDTH
    const compactSideHeight = sideThumbHeight ?? COMPACT_SIDE_THUMB_HEIGHT
    const usesFixedSideThumb = layout === 'side' && sideThumbWidth != null

    return (
      <article className={['group', className].filter(Boolean).join(' ')}>
        <Link
          href={href}
          className={
            layout === 'side'
              ? usesFixedSideThumb
                ? 'grid items-stretch gap-3'
                : 'grid grid-cols-[112px_1fr] items-stretch gap-3'
              : 'block'
          }
          style={
            usesFixedSideThumb
              ? { gridTemplateColumns: `${compactSideWidth}px minmax(0, 1fr)` }
              : undefined
          }
        >
          <StoryThumb
            src={imgSrc}
            alt={article.title}
            unoptimized={unoptimized}
            aspect={layout === 'side' && !usesFixedSideThumb ? '4/3' : '16/10'}
            fixedHeightPx={usesFixedSideThumb ? compactSideHeight : undefined}
            className={layout === 'side' ? 'shrink-0 border-0' : 'w-full'}
            style={usesFixedSideThumb ? { width: compactSideWidth } : undefined}
          />
          <StoryTitle
            title={article.title}
            kicker={kicker}
            dense={layout === 'side'}
            plainTitle={plainTitle}
            className={layout === 'side' ? 'flex min-w-0 items-center py-3 pr-3' : 'mt-3'}
            titleClassName={titleBelowMedia ? belowMediaTitleClass : belowMediaTextClass(titleClassName)}
            underlineOnHover={underlineOnHover}
            as="p"
          />
          {summary ? <StorySummary summary={summary} className={belowMediaSummaryClass} /> : null}
        </Link>
      </article>
    )
  }

  if (variant === 'rail') {
    return (
      <article className={['group', className].filter(Boolean).join(' ')}>
        <Link href={href} className="block">
          {titleFirst ? (
            <StoryTitle
              title={article.title}
              kicker={kicker}
              plainTitle={plainTitle}
              className="mb-2"
              titleClassName={belowMediaTitleClass}
              underlineOnHover={underlineOnHover}
            />
          ) : null}
          <StoryThumb src={imgSrc} alt={article.title} unoptimized={unoptimized} hoverScale />
          {titleFirst ? null : (
            <StoryTitle
              title={article.title}
              kicker={kicker}
              plainTitle={plainTitle}
              className="mt-2"
              titleClassName={belowMediaTitleClass}
              underlineOnHover={underlineOnHover}
            />
          )}
          {summary ? <StorySummary summary={summary} className={belowMediaSummaryClass} /> : null}
        </Link>
      </article>
    )
  }

  if (variant === 'hero-lead') {
    const stackedFeatured = layout === 'stacked' && titleFirst

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
          {stackedFeatured ? (
            <StoryTitle
              title={article.title}
              kicker={kicker}
              dense={dense}
              plainTitle={plainTitle}
              className="mb-3"
              titleClassName={belowMediaTitleClass}
              underlineOnHover={underlineOnHover}
            />
          ) : null}
          <StoryThumb
            src={imgSrc}
            alt={article.title}
            unoptimized={unoptimized}
            aspect={layout === 'side' ? '4/3' : '16/10'}
          />
          {stackedFeatured ? null : (
            <StoryTitle
              title={article.title}
              kicker={kicker}
              dense={dense}
              plainTitle={plainTitle}
              className={layout === 'side' ? '' : 'mt-3'}
              titleClassName={
                layout === 'stacked' ? belowMediaTitleClass : belowMediaTextClass(titleClassName)
              }
              underlineOnHover={underlineOnHover}
            />
          )}
          {summary ? <StorySummary summary={summary} className={belowMediaSummaryClass} /> : null}
        </Link>
      </article>
    )
  }

  return (
    <article className={['group', className].filter(Boolean).join(' ')}>
      <Link href={href} className="block">
        <StoryThumb src={imgSrc} alt={article.title} unoptimized={unoptimized} hoverScale />
        <StoryTitle
          title={article.title}
          plainTitle={plainTitle}
          className="mt-3"
          titleClassName={belowMediaTitleClass}
          underlineOnHover={underlineOnHover}
        />
        {summary ? <StorySummary summary={summary} className={belowMediaSummaryClass} /> : null}
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
  fixedHeightPx?: number
  className?: string
  style?: CSSProperties
  hoverScale?: boolean
}

function StoryThumb({
  src,
  alt,
  unoptimized,
  aspect = '16/10',
  fixedHeightPx,
  className,
  style,
  hoverScale = false,
}: IStoryThumbProps): JSX.Element {
  const aspectClass =
    fixedHeightPx != null
      ? ''
      : aspect === '4/3'
        ? 'aspect-[4/3]'
        : aspect === '16/9'
          ? 'aspect-[16/9]'
          : 'aspect-[16/10]'

  return (
    <div
      className={[
        'overflow-hidden rounded border border-neutral-200 bg-neutral-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <div
        className={['relative w-full', aspectClass].filter(Boolean).join(' ')}
        style={fixedHeightPx != null ? { height: fixedHeightPx } : undefined}
      >
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
  plainTitle?: boolean
  className?: string
  titleClassName?: string
  underlineOnHover?: boolean
  as?: 'h3' | 'p'
}

function StoryTitle({
  title,
  kicker,
  dense = false,
  plainTitle = false,
  className,
  titleClassName,
  underlineOnHover = false,
  as,
}: IStoryTitleProps): JSX.Element {
  const Tag = as ?? (plainTitle ? 'p' : 'h3')
  const sizeClass = dense
    ? plainTitle
      ? PLAIN_COMPACT_SIDE_TITLE_CLASS
      : COMPACT_SIDE_TITLE_CLASS
    : plainTitle
      ? PLAIN_DEFAULT_TITLE_CLASS
      : DEFAULT_TITLE_CLASS

  return (
    <div className={className}>
      {kicker ? (
        <p className="text-[11px] font-extrabold tracking-[0.22em] text-brand">{kicker}</p>
      ) : null}
      <Tag
        className={[
          'mt-1 line-clamp-3 overflow-hidden leading-snug text-neutral-950',
          titleHoverClass(underlineOnHover),
          sizeClass,
          plainTitle ? 'font-sans' : '',
          titleClassName ?? '',
        ].join(' ')}
      >
        {title}
      </Tag>
    </div>
  )
}

interface IStorySummaryProps {
  summary: string
  className?: string
}

function StorySummary({ summary, className }: IStorySummaryProps): JSX.Element {
  return (
    <p
      className={[
        'mt-2 line-clamp-3 overflow-hidden text-sm leading-relaxed text-neutral-800',
        className ?? '',
      ].join(' ')}
    >
      {summary}
    </p>
  )
}
