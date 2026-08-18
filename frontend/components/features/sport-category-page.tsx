'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'

import { AdSlot } from '@/components/ui/ad-slot'
import { EmptyState } from '@/components/ui/feed-state'
import { SitePagination } from '@/components/ui/site-pagination'
import { usePageAds } from '@/context/page-ads-context'
import type { IArticle, IArticleConnection } from '@/interfaces/article'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'
import { sportPagePath } from '@/lib/helpers/section-labels'
import {
  authorInitial,
  chunkSportArchiveGrid,
  SPORT_ARCHIVE_EXCERPT_MAX_CHARS,
  SPORT_CATEGORY_PAGE_SIZE,
  splitSportArchiveLayout,
} from '@/lib/helpers/sport-archive'
import { deckBelowTitle } from '@/lib/helpers/text-helpers'

interface ISectionArchivePageProps {
  title: string
  parentHref: string
  parentLabel: string
  basePath: string
  connection: IArticleConnection
  emptyLabel: string
  /** When false, omit the parent › title breadcrumb (landing archives). */
  showBreadcrumb?: boolean
  /** When false, omit the section H1 (paginated landing archives). */
  showHeading?: boolean
  /** Stories per page. Defaults to the connection page size or sport archives. */
  pageSize?: number
  /**
   * `featured` is Baseball lead+rail+grid. `grid` shows every story as a card
   * so a page of 16 remains 16 news items.
   */
  bodyLayout?: 'featured' | 'grid'
}

interface ISportCategoryPageProps {
  slug: string
  sportTitle: string
  connection: IArticleConnection
}

/**
 * Metro-style section archive: uppercase header, featured+rail, then a card grid.
 *
 * @param props Breadcrumb, title, paginated articles, and empty copy.
 * @returns Category archive page.
 */
export function SectionArchivePage({
  title,
  parentHref,
  parentLabel,
  basePath,
  connection,
  emptyLabel,
  showBreadcrumb = true,
  showHeading = true,
  pageSize,
  bodyLayout = 'featured',
}: ISectionArchivePageProps): JSX.Element {
  const t = useTranslations('common')
  const resolvedPageSize = pageSize || connection.pageSize || SPORT_CATEGORY_PAGE_SIZE

  return (
    <div>
      {showHeading ? (
        <SportArchiveHeader
          parentHref={parentHref}
          parentLabel={parentLabel}
          title={title}
          showBreadcrumb={showBreadcrumb}
        />
      ) : null}
      <ArchiveBody
        articles={connection.items}
        emptyLabel={emptyLabel}
        bodyLayout={bodyLayout}
      />
      <SitePagination
        page={connection.page}
        pageSize={resolvedPageSize}
        total={connection.total}
        basePath={basePath}
        previousLabel={t('previous')}
        nextLabel={t('next')}
        navLabel={t('paginationNav')}
        goToPageLabel={(page) => t('goToPage', { page })}
      />
    </div>
  )
}

/**
 * Metro-style sport archive: uppercase header, featured+rail, then a card grid.
 *
 * @param props Sport slug, localized title, and paginated articles.
 * @returns Sport category archive page.
 */
export function SportCategoryPage({
  slug,
  sportTitle,
  connection,
}: ISportCategoryPageProps): JSX.Element {
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <SectionArchivePage
      title={sportTitle}
      parentHref="/sports"
      parentLabel={tNav('sectionLabels.sports')}
      basePath={sportPagePath(slug)}
      connection={connection}
      emptyLabel={t('sportArchiveEmpty')}
    />
  )
}

/**
 * Uppercase breadcrumb, section H1, and brand rule matching Metro's subsection header.
 *
 * @param props Localized parent and section labels.
 * @returns Archive page header.
 */
function SportArchiveHeader({
  parentHref,
  parentLabel,
  title,
  showBreadcrumb = true,
}: {
  parentHref: string
  parentLabel: string
  title: string
  showBreadcrumb?: boolean
}): JSX.Element {
  const t = useTranslations('common')

  return (
    <header className="mb-6">
      {showBreadcrumb ? (
        <nav
          className="font-sans text-sm font-normal uppercase tracking-wider text-neutral-500"
          aria-label={t('breadcrumb')}
        >
          <Link href={parentHref} className="hover:underline">
            {parentLabel}
          </Link>
          <span aria-hidden="true" className="mx-1">
            ›
          </span>
          <span>{title}</span>
        </nav>
      ) : null}
      <h1 className="mt-1 font-sans text-2xl font-semibold uppercase tracking-wider text-neutral-950 sm:text-3xl">
        {title}
      </h1>
      <div className="mt-2 border-t-2 border-[color:var(--brand-red)]" />
    </header>
  )
}

/**
 * Featured lead, compact rail, and remaining cards — or a full 16-card grid.
 *
 * @param props Articles, empty copy, and body layout.
 * @returns Archive cards, or an empty state.
 */
function ArchiveBody({
  articles,
  emptyLabel,
  bodyLayout,
}: {
  articles: IArticle[]
  emptyLabel: string
  bodyLayout: 'featured' | 'grid'
}): JSX.Element {
  if (articles.length === 0) {
    return (
      <div className="py-10">
        <EmptyState>{emptyLabel}</EmptyState>
      </div>
    )
  }
  if (bodyLayout === 'grid') {
    return <SportArchiveGrid articles={articles} />
  }
  return <SportArchiveFeaturedBody layout={splitSportArchiveLayout(articles)} />
}

/**
 * Baseball featured lead plus rail, then the remaining grid.
 *
 * @param props Split featured/rail/grid layout.
 * @returns Featured band and grid, or null when there is no lead.
 */
function SportArchiveFeaturedBody({
  layout,
}: {
  layout: ReturnType<typeof splitSportArchiveLayout>
}): JSX.Element | null {
  if (!layout.featured) {
    return null
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SportArchiveFeaturedCard article={layout.featured} />
        <SportArchiveRail articles={layout.rail} />
      </div>
      <SportArchiveGrid articles={layout.grid} />
    </>
  )
}

/**
 * Horizontal archive ribbon using the shared section-grid ad slot.
 *
 * @param props Zero-based ribbon index for distinct mock creatives.
 * @returns Advertisement ribbon section.
 */
function SportArchiveAdRibbon({ index }: { index: number }): JSX.Element {
  const t = useTranslations('common')
  const { variantFor } = usePageAds()

  return (
    <section aria-label={t('advertisement')} className="py-6">
      <AdSlot
        slotKey="section-grid-ribbon"
        index={index}
        variant={variantFor('before_section', 'ribbon')}
      />
    </section>
  )
}

/**
 * Grid stories with a ribbon after the featured band and after every two rows.
 *
 * @param props Remaining articles.
 * @returns Grid chunks separated by ribbons, or null when empty.
 */
function SportArchiveGrid({ articles }: { articles: IArticle[] }): JSX.Element | null {
  if (articles.length === 0) {
    return null
  }

  return (
    <>
      <SportArchiveAdRibbon index={0} />
      {chunkSportArchiveGrid(articles).map((chunk, chunkIndex) => (
        <div key={chunk[0]?.id ?? `grid-chunk-${chunkIndex}`}>
          {chunkIndex > 0 ? <SportArchiveAdRibbon index={chunkIndex} /> : null}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {chunk.map((article) => (
              <SportArchiveFeaturedCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/**
 * Large image card used for the featured lead and the 3-column grid.
 *
 * @param props Article to render.
 * @returns Metro-style image story card.
 */
function SportArchiveFeaturedCard({ article }: { article: IArticle }): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`
  const excerpt = deckBelowTitle(article.title, article.summary, SPORT_ARCHIVE_EXCERPT_MAX_CHARS)

  return (
    <Link href={href} className="group block text-neutral-950 hover:text-neutral-950">
      <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
        <SportArchiveCardImage article={article} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        <div className="p-4">
          <h2 className="font-sans text-lg font-semibold leading-tight text-neutral-950 group-hover:text-[color:var(--brand-red)] sm:text-xl">
            {article.title}
          </h2>
          {excerpt ? (
            <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-neutral-600">{excerpt}</p>
          ) : null}
          <SportArchiveByline article={article} showAvatar />
        </div>
      </article>
    </Link>
  )
}

/**
 * Two-row rail: first story plus square ad, a rule, then the remaining stories.
 *
 * @param props Rail articles after the featured lead.
 * @returns Featured-band side rail.
 */
function SportArchiveRail({ articles }: { articles: IArticle[] }): JSX.Element {
  const firstStory = articles[0]
  const secondRow = articles.slice(1)

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {firstStory ? <SportArchiveRailCard article={firstStory} /> : null}
        <SportArchiveRailAd />
      </div>
      {secondRow.length > 0 ? (
        <>
          <div className="my-6 border-t border-neutral-200" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {secondRow.map((article) => (
              <SportArchiveRailCard key={article.id} article={article} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * Square advertisement occupying the top-right rail cell.
 *
 * @returns Rail square ad unit.
 */
function SportArchiveRailAd(): JSX.Element {
  const t = useTranslations('common')

  return (
    <section aria-label={t('advertisement')} className="h-full">
      <AdSlot slotKey="sport-archive-rail" variant="square" className="h-full rounded-xl" />
    </section>
  )
}

/**
 * Compact picture card for the featured-band side rail, with copy under the image.
 *
 * @param props Article to render.
 * @returns Rail story card with headline and byline below the news screen.
 */
function SportArchiveRailCard({ article }: { article: IArticle }): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`

  return (
    <Link href={href} className="group block text-neutral-950 hover:text-neutral-950">
      <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
        <SportArchiveCardImage
          article={article}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="p-3">
          <h2 className="font-sans text-[15px] font-semibold leading-tight text-neutral-950 group-hover:text-[color:var(--brand-red)] sm:text-base">
            {article.title}
          </h2>
          <SportArchiveByline article={article} showAvatar={false} />
        </div>
      </article>
    </Link>
  )
}

/**
 * 3:2 thumbnail for archive cards.
 *
 * @param props Article, image sizes, and optional wrapper class.
 * @returns Cover image block.
 */
function SportArchiveCardImage({
  article,
  sizes,
  className,
}: {
  article: IArticle
  sizes: string
  className?: string
}): JSX.Element {
  const imgSrc = articleImageSrc(article)

  return (
    <div className={className ?? 'relative overflow-hidden'}>
      <div className="relative aspect-[3/2] w-full">
        <Image
          src={imgSrc}
          alt={article.title}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          unoptimized={isDataUri(imgSrc)}
        />
      </div>
    </div>
  )
}

/**
 * Author name and compact archive timestamp, optionally with an initial avatar.
 *
 * @param props Article and whether to show the avatar.
 * @returns Byline row.
 */
function SportArchiveByline({
  article,
  showAvatar,
}: {
  article: IArticle
  showAvatar: boolean
}): JSX.Element {
  const format = useFormatter()
  const t = useTranslations('common')
  const author = article.authorName || t('newsCoreStaff')
  const timestamp = new Date(article.publishedAt ?? article.createdAt)
  const date = format.dateTime(timestamp, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div
      className={
        showAvatar
          ? 'mt-3 flex items-center gap-2.5 border-t border-neutral-200 pt-3'
          : 'mt-2.5 flex items-center gap-1.5'
      }
    >
      {showAvatar ? (
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-red)]/10 font-sans text-[10px] font-semibold text-[color:var(--brand-red)]">
          {authorInitial(author)}
        </span>
      ) : null}
      <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-700">
          {showAvatar ? author : t('byAuthor', { author })}
        </span>
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-neutral-300" />
        <span>{date}</span>
      </p>
    </div>
  )
}
