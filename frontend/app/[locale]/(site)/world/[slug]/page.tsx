import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { WorldRegionPage } from '@/components/features/world-region-page'
import { StickyAdRibbon } from '@/components/ui/sticky-ad-ribbon'
import type { IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { fetchCategoryArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { homepageSectionTitle, type SectionLabelTranslator } from '@/lib/helpers/section-labels'
import { parseArchivePage } from '@/lib/helpers/sport-archive'
import {
  archiveConnectionFromArticles,
  findWorldArchiveSlot,
  WORLD_PAGE_NAME,
  WORLD_REGION_PAGE_SIZE,
  worldArchiveCategorySlugs,
} from '@/lib/helpers/world-archive'
import { getTranslations } from '@/lib/locale-server'
import { getServerMarketScope } from '@/lib/market-server'

interface IWorldArchivePageProps {
  params: { slug: string }
  searchParams: { page?: string | string[] }
}

interface IWorldArchiveData {
  slot: IFeedSlot
  connection: IArticleConnection
}

/**
 * Localized region heading for archive metadata and the page H1.
 *
 * @param positionKey World section position key.
 * @param displayName CMS slot display name for custom regions.
 * @param translate Navigation section-label translator.
 * @returns Localized or CMS region title.
 */
function worldArchiveTitle(
  positionKey: string,
  displayName: string | null,
  translate: SectionLabelTranslator,
): string {
  return homepageSectionTitle(positionKey, displayName, translate, WORLD_PAGE_NAME)
}

/**
 * Empty connection when a region category has not been created yet.
 *
 * @param page Requested 1-indexed page.
 * @returns Paginated payload with no stories.
 */
function emptyRegionConnection(page: number): IArticleConnection {
  return {
    items: [],
    total: 0,
    page,
    pageSize: WORLD_REGION_PAGE_SIZE,
    hasMore: false,
  }
}

/**
 * Fetch one category archive, treating a missing category as empty.
 *
 * @param options Category slug, market scope, and pagination.
 * @returns Paginated articles, or an empty list when the category is absent.
 */
async function fetchCategoryOrEmpty(options: {
  slug: string
  page: number
  market: string
  town: string | null
  county: string | null
}): Promise<IArticleConnection> {
  try {
    return await fetchCategoryArticles({
      slug: options.slug,
      market: options.market,
      page: options.page,
      pageSize: WORLD_REGION_PAGE_SIZE,
      town: options.town,
      county: options.county,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.toLowerCase().includes('not found')) {
      return emptyRegionConnection(options.page)
    }
    throw error
  }
}

/**
 * Load region articles, falling back to the World pool the landing page uses.
 *
 * @param options Category slugs to try, most specific first, plus pagination.
 * @returns The first populated connection, or an empty list when none have stories.
 */
async function loadRegionArticles(options: {
  slugs: string[]
  page: number
  market: string
  town: string | null
  county: string | null
}): Promise<IArticleConnection> {
  let fallback = emptyRegionConnection(options.page)
  for (const slug of options.slugs) {
    const connection = await fetchCategoryOrEmpty({ ...options, slug })
    if (connection.total > 0) {
      return connection
    }
    fallback = connection
  }
  return fallback
}

/**
 * Load a World region archive when the slug matches a World-page region row.
 *
 * @param options Region slug and 1-indexed page.
 * @returns Slot plus paginated articles, or null when the slug is not a region.
 */
async function loadWorldArchive(options: {
  slug: string
  page: number
}): Promise<IWorldArchiveData | null> {
  const scope = getServerMarketScope()
  const feed = await fetchPageFeed(scope.marketCode, WORLD_PAGE_NAME, scope.town, scope.county)
  const slot = findWorldArchiveSlot(feed?.slots ?? [], options.slug)
  if (!slot) {
    return null
  }
  const connection = await loadRegionArticles({
    slugs: worldArchiveCategorySlugs(slot.positionKey),
    page: options.page,
    market: scope.marketCode,
    town: scope.town,
    county: scope.county,
  })
  if (connection.total > 0 || connection.items.length > 0) {
    return { slot, connection }
  }
  return {
    slot,
    connection: archiveConnectionFromArticles(slot.articles, options.page),
  }
}

/**
 * Build document title and description for a World region archive.
 *
 * @param props Route params used to resolve the region label.
 * @returns Metadata for the region archive page.
 */
export async function generateMetadata({ params }: IWorldArchivePageProps): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const archive = await loadWorldArchive({ slug, page: 1 })
  if (!archive) {
    return { title: tCommon('notFound') }
  }
  const regionTitle = worldArchiveTitle(archive.slot.positionKey, archive.slot.displayName, tNav)
  return {
    title: `NewsCore — ${regionTitle}`,
    description: tCommon('meta.worldRegionDescription', { region: regionTitle }),
  }
}

/**
 * Public World region archive: stories in a region, newest first, paginated.
 *
 * @param props Route slug and optional `page` search param.
 * @returns Region archive page, or a 404 when the slug is not a World region.
 */
export default async function WorldArchiveRoutePage({
  params,
  searchParams,
}: IWorldArchivePageProps): Promise<JSX.Element> {
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const page = parseArchivePage(searchParams.page)
  const archive = await loadWorldArchive({ slug, page })
  if (!archive) {
    notFound()
  }
  const tNav = await getTranslations('navigation')
  const regionTitle = worldArchiveTitle(archive.slot.positionKey, archive.slot.displayName, tNav)

  return (
    <>
      <main id="main-content" className="site-container py-8">
        <WorldRegionPage slug={slug} regionTitle={regionTitle} connection={archive.connection} />
      </main>
      <StickyAdRibbon />
    </>
  )
}
