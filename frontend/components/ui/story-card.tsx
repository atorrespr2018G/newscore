import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import type { IArticle } from '@/interfaces/article'
import { EditorialArticleLink } from '@/components/ui/editorial-article-link'
import { ArticleLeadMedia } from '@/components/ui/article-lead-media'
import { articleCardPreviewVideoSrc } from '@/lib/helpers/article-video-src'
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
  /** When set, opens an in-context preview instead of navigating to the article page. */
  onArticleClick?: (article: IArticle) => void
}

const TITLE_HOVER_BRAND = 'group-hover:text-brand'
const TITLE_HOVER_UNDERLINE = 'group-hover:underline'
const HEADLINE_LINK_HOVER_BRAND =
  'group block text-[14px] font-extrabold leading-snug text-neutral-950 hover:text-brand'
const HEADLINE_LINK_HOVER_UNDERLINE =
  'group block text-[14px] font-extrabold leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'
const PLAIN_HEADLINE_LINK_HOVER_BRAND =
  'group block font-serif text-[14px] font-normal leading-snug text-neutral-950 hover:text-brand'
const PLAIN_HEADLINE_LINK_HOVER_UNDERLINE =
  'group block font-serif text-[14px] font-normal leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'
const TEXT_LINK_HOVER_BRAND =
  'group block text-[15px] font-extrabold leading-snug text-neutral-950 hover:text-brand'
const TEXT_LINK_HOVER_UNDERLINE =
  'group block text-[15px] font-extrabold leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'
const PLAIN_TEXT_LINK_HOVER_BRAND =
  'group block font-serif text-[15px] font-normal leading-snug text-neutral-950 hover:text-brand'
const PLAIN_TEXT_LINK_HOVER_UNDERLINE =
  'group block font-serif text-[15px] font-normal leading-snug text-neutral-950 hover:text-neutral-950 hover:underline'

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

interface IStoryCardActivatorProps {
  article: IArticle
  className?: string
  style?: CSSProperties
  onArticleClick?: (article: IArticle) => void
  children: ReactNode
}

/**
 * Render a story card as either a navigation link or an in-context preview trigger.
 *
 * @param props Article, styling, optional click handler, and child content.
 * @returns A link on the public site or a button in editorial preview surfaces.
 */
function StoryCardActivator({
  article,
  className,
  style,
  onArticleClick,
  children,
}: IStoryCardActivatorProps): JSX.Element {
  return (
    <EditorialArticleLink
      article={article}
      className={className}
      style={style}
      onArticleClick={onArticleClick}
    >
      {children}
    </EditorialArticleLink>
  )
}

interface IStoryImage {
  src: string
  unoptimized: boolean
  /** When set, the card shows a still frame of this video instead of the image. */
  previewVideoSrc: string | null
}

function storyImage(article: IArticle): IStoryImage {
  const src = articleImageSrc(article)
  return {
    src,
    unoptimized: isDataUri(src),
    previewVideoSrc: articleCardPreviewVideoSrc(article),
  }
}

function storySummary(
  article: IArticle,
  variant: StoryCardVariant,
  layout: 'side' | 'stacked',
  displaySummary: boolean,
): string | null {
  return showsSummaryBelowMedia(variant, layout, displaySummary)
    ? deckBelowTitle(article.title, article.summary, 200)
    : null
}

function compactLinkClass(layout: 'side' | 'stacked', usesFixedSideThumb: boolean): string {
  if (layout !== 'side') {
    return 'block'
  }

  return usesFixedSideThumb
    ? 'grid items-stretch gap-3'
    : 'grid grid-cols-[112px_1fr] items-stretch gap-3'
}

/**
 * Render an article preview card, dispatching to the component for its variant.
 *
 * @param props - Story card props including the article and presentation variant.
 * @returns The rendered story card for the requested variant.
 */
export function StoryCard(props: IStoryCardProps): JSX.Element {
  switch (props.variant ?? 'grid') {
    case 'headline-only':
      return <HeadlineOnlyStoryCard {...props} />
    case 'text-link':
      return <TextLinkStoryCard {...props} />
    case 'compact':
      return <CompactStoryCard {...props} />
    case 'rail':
      return <RailStoryCard {...props} />
    case 'hero-lead':
      return <HeroLeadStoryCard {...props} />
    default:
      return <GridStoryCard {...props} />
  }
}

function HeadlineOnlyStoryCard({
  article,
  compact = false,
  className,
  titleClassName,
  plainTitle = false,
  underlineOnHover = false,
  onArticleClick,
}: IStoryCardProps): JSX.Element {
  return (
    <li className={className}>
      <StoryCardActivator
        article={article}
        onArticleClick={onArticleClick}
        className={[
          headlineOnlyLinkClass(plainTitle, underlineOnHover),
          compact ? '' : 'py-3',
        ].join(' ')}
      >
        <span className={belowMediaTextClass(titleClassName)}>{article.title}</span>
      </StoryCardActivator>
    </li>
  )
}

function TextLinkStoryCard({
  article,
  className,
  titleClassName,
  plainTitle = false,
  underlineOnHover = false,
  onArticleClick,
}: IStoryCardProps): JSX.Element {
  return (
    <article className={className}>
      <StoryCardActivator
        article={article}
        onArticleClick={onArticleClick}
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
      </StoryCardActivator>
    </article>
  )
}

function CompactStoryCard({
  article,
  kicker,
  layout = 'side',
  showSummary,
  titleFirst = false,
  sideThumbWidth,
  sideThumbHeight,
  className,
  titleClassName,
  summaryClassName,
  plainTitle = false,
  underlineOnHover = false,
  onArticleClick,
}: IStoryCardProps): JSX.Element {
  const { src, unoptimized, previewVideoSrc } = storyImage(article)
  const summary = storySummary(article, 'compact', layout, showSummary ?? titleFirst)
  const width = sideThumbWidth ?? COMPACT_SIDE_THUMB_WIDTH
  const height = sideThumbHeight ?? COMPACT_SIDE_THUMB_HEIGHT
  const usesFixedSideThumb = layout === 'side' && sideThumbWidth != null

  return (
    <article className={['group', className].filter(Boolean).join(' ')}>
      <StoryCardActivator
        article={article}
        onArticleClick={onArticleClick}
        className={compactLinkClass(layout, usesFixedSideThumb)}
        style={usesFixedSideThumb ? { gridTemplateColumns: `${width}px minmax(0, 1fr)` } : undefined}
      >
        <StoryThumb
          src={src}
          alt={article.title}
          unoptimized={unoptimized}
          previewVideoArticle={article}
          previewVideoSrc={previewVideoSrc}
          aspect={layout === 'side' && !usesFixedSideThumb ? '4/3' : '16/10'}
          fixedHeightPx={usesFixedSideThumb ? height : undefined}
          className={layout === 'side' ? 'shrink-0 border-0' : 'w-full'}
          style={usesFixedSideThumb ? { width } : undefined}
        />
        <StoryTitle
          title={article.title}
          kicker={kicker}
          dense={layout === 'side'}
          plainTitle={plainTitle}
          className={layout === 'side' ? 'flex min-w-0 items-center py-3 pr-3' : 'mt-3'}
          titleClassName={belowMediaTextClass(titleClassName)}
          underlineOnHover={underlineOnHover}
          as="p"
        />
        {summary ? <StorySummary summary={summary} className={belowMediaTextClass(summaryClassName)} /> : null}
      </StoryCardActivator>
    </article>
  )
}

function RailStoryCard({
  article,
  kicker,
  layout = 'side',
  showSummary,
  titleFirst = false,
  className,
  titleClassName,
  summaryClassName,
  plainTitle = false,
  underlineOnHover = false,
  onArticleClick,
}: IStoryCardProps): JSX.Element {
  const { src, unoptimized, previewVideoSrc } = storyImage(article)
  const summary = storySummary(article, 'rail', layout, showSummary ?? titleFirst)
  const titleClass = belowMediaTextClass(titleClassName)

  return (
    <article className={['group', className].filter(Boolean).join(' ')}>
      <StoryCardActivator article={article} onArticleClick={onArticleClick} className="block">
        {titleFirst ? (
          <StoryTitle
            title={article.title}
            kicker={kicker}
            plainTitle={plainTitle}
            className="mb-2"
            titleClassName={titleClass}
            underlineOnHover={underlineOnHover}
          />
        ) : null}
        <StoryThumb
          src={src}
          alt={article.title}
          unoptimized={unoptimized}
          previewVideoArticle={article}
          previewVideoSrc={previewVideoSrc}
          hoverScale
        />
        {titleFirst ? null : (
          <StoryTitle
            title={article.title}
            kicker={kicker}
            plainTitle={plainTitle}
            className="mt-2"
            titleClassName={titleClass}
            underlineOnHover={underlineOnHover}
          />
        )}
        {summary ? <StorySummary summary={summary} className={belowMediaTextClass(summaryClassName)} /> : null}
      </StoryCardActivator>
    </article>
  )
}

function HeroLeadStoryCard({
  article,
  kicker,
  layout = 'side',
  dense = false,
  showSummary,
  titleFirst = false,
  className,
  titleClassName,
  summaryClassName,
  plainTitle = false,
  underlineOnHover = false,
  onArticleClick,
}: IStoryCardProps): JSX.Element {
  const { src, unoptimized, previewVideoSrc } = storyImage(article)
  const summary = storySummary(article, 'hero-lead', layout, showSummary ?? titleFirst)
  const titleClass = belowMediaTextClass(titleClassName)
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
      <StoryCardActivator
        article={article}
        onArticleClick={onArticleClick}
        className={layout === 'side' ? 'group grid grid-cols-[160px_1fr] gap-4' : 'group block'}
      >
        {stackedFeatured ? (
          <StoryTitle
            title={article.title}
            kicker={kicker}
            dense={dense}
            plainTitle={plainTitle}
            className="mb-3"
            titleClassName={titleClass}
            underlineOnHover={underlineOnHover}
          />
        ) : null}
        <StoryThumb
          src={src}
          alt={article.title}
          unoptimized={unoptimized}
          previewVideoArticle={article}
          previewVideoSrc={previewVideoSrc}
          aspect={layout === 'side' ? '4/3' : '16/10'}
        />
        {stackedFeatured ? null : (
          <StoryTitle
            title={article.title}
            kicker={kicker}
            dense={dense}
            plainTitle={plainTitle}
            className={layout === 'side' ? '' : 'mt-3'}
            titleClassName={titleClass}
            underlineOnHover={underlineOnHover}
          />
        )}
        {summary ? <StorySummary summary={summary} className={belowMediaTextClass(summaryClassName)} /> : null}
      </StoryCardActivator>
    </article>
  )
}

function GridStoryCard({
  article,
  layout = 'side',
  showAuthor = false,
  showSummary,
  titleFirst = false,
  className,
  titleClassName,
  summaryClassName,
  plainTitle = false,
  underlineOnHover = false,
  onArticleClick,
}: IStoryCardProps): JSX.Element {
  const { src, unoptimized, previewVideoSrc } = storyImage(article)
  const summary = storySummary(article, 'grid', layout, showSummary ?? titleFirst)

  return (
    <article className={['group', className].filter(Boolean).join(' ')}>
      <StoryCardActivator article={article} onArticleClick={onArticleClick} className="block">
        <StoryThumb
          src={src}
          alt={article.title}
          unoptimized={unoptimized}
          previewVideoArticle={article}
          previewVideoSrc={previewVideoSrc}
          hoverScale
        />
        <StoryTitle
          title={article.title}
          plainTitle={plainTitle}
          className="mt-3"
          titleClassName={belowMediaTextClass(titleClassName)}
          underlineOnHover={underlineOnHover}
        />
        {summary ? <StorySummary summary={summary} className={belowMediaTextClass(summaryClassName)} /> : null}
        {showAuthor ? (
          <p className="mt-1 text-xs font-semibold text-neutral-600">{article.authorName}</p>
        ) : null}
      </StoryCardActivator>
    </article>
  )
}

interface IStoryThumbProps {
  src: string
  alt: string
  unoptimized: boolean
  /** Article used to render a still video frame when previewVideoSrc is set. */
  previewVideoArticle?: IArticle
  previewVideoSrc?: string | null
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
  previewVideoArticle,
  previewVideoSrc,
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
  const mediaClass = [
    'object-cover',
    hoverScale ? 'transition-transform duration-200 group-hover:scale-[1.02]' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const showsVideoFrame = Boolean(previewVideoSrc) && previewVideoArticle != null

  return (
    <div
      className={[
        'w-full overflow-hidden rounded border border-neutral-200 bg-neutral-100',
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
        {showsVideoFrame ? (
          <ArticleLeadMedia
            article={previewVideoArticle}
            mode="preview-frame"
            className={['absolute inset-0 h-full w-full', mediaClass].join(' ')}
          />
        ) : (
          <Image src={src} alt={alt} fill className={mediaClass} unoptimized={unoptimized} />
        )}
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
          plainTitle ? 'font-serif' : '',
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
