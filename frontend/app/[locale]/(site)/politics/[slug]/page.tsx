import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PoliticsCategoryPage } from '@/components/features/politics-category-page'
import { StickyAdRibbon } from '@/components/ui/sticky-ad-ribbon'
import type { IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { fetchCategoryArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { homepageSectionTitle, type SectionLabelTranslator } from '@/lib/helpers/section-labels'
import {
  POLITICS_CATEGORY_PAGE_SIZE,
  POLITICS_PAGE_NAME,
  archiveConnectionFromPoliticsArticles,
  findPoliticsArchiveSlot,
  politicsArchiveCategorySlugs,
} from '@/lib/helpers/politics-archive'
import { parseArchivePage } from '@/lib/helpers/sport-archive'
import { getTranslations } from '@/lib/locale-server'
import { getServerMarketScope } from '@/lib/market-server'

interface IPoliticsArchivePageProps {
  params: { slug: string }
  searchParams: { page?: string | string[] }
}

interface IPoliticsArchiveData {
  slot: IFeedSlot
  connection: IArticleConnection
}

/**
 * Localized Politics topic heading for archive metadata and the page H1.
 *
 * @param positionKey Politics section position key.
 * @param displayName CMS slot display name for custom topics.
 * @param translate Navigation section-label translator.
 * @returns Localized or CMS topic title.
 */
function politicsArchiveTitle(
  positionKey: string,
  displayName: string | null,
  translate: SectionLabelTranslator,
): string {
  return homepageSectionTitle(positionKey, displayName, translate, POLITICS_PAGE_NAME)
}

/**
 * Empty connection when a topic category has not been created yet.
 *
 * @param page Requested 1-indexed page.
 * @returns Paginated payload with no stories.
 */
function emptyTopicConnection(page: number): IArticleConnection {
  return {
    items: [],
    total: 0,
    page,
    pageSize: POLITICS_CATEGORY_PAGE_SIZE,
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
      pageSize: POLITICS_CATEGORY_PAGE_SIZE,
      town: options.town,
      county: options.county,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.toLowerCase().includes('not found')) {
      return emptyTopicConnection(options.page)
    }
    throw error
  }
}

/**
 * Load topic articles, falling back to the Politics pool the landing page uses.
 *
 * @param options Category slugs to try, most specific first, plus pagination.
 * @returns The first populated connection, or an empty list when none have stories.
 */
async function loadTopicArticles(options: {
  slugs: string[]
  page: number
  market: string
  town: string | null
  county: string | null
}): Promise<IArticleConnection> {
  let fallback = emptyTopicConnection(options.page)
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
 * Load a Politics topic archive when the slug matches a Politics-page row.
 *
 * @param options Topic slug and 1-indexed page.
 * @returns Slot plus paginated articles, or null when the slug is not a topic.
 */
async function loadPoliticsArchive(options: {
  slug: string
  page: number
}): Promise<IPoliticsArchiveData | null> {
  const scope = getServerMarketScope()
  const feed = await fetchPageFeed(
    scope.marketCode,
    POLITICS_PAGE_NAME,
    scope.town,
    scope.county,
  )
  const slot = findPoliticsArchiveSlot(feed?.slots ?? [], options.slug)
  if (!slot) {
    return null
  }
  const connection = await loadTopicArticles({
    slugs: politicsArchiveCategorySlugs(slot.positionKey),
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
    connection: archiveConnectionFromPoliticsArticles(slot.articles, options.page),
  }
}

/**
 * Build document title and description for a Politics topic archive.
 *
 * @param props Route params used to resolve the topic label.
 * @returns Metadata for the topic archive page.
 */
export async function generateMetadata({
  params,
}: IPoliticsArchivePageProps): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const archive = await loadPoliticsArchive({ slug, page: 1 })
  if (!archive) {
    return { title: tCommon('notFound') }
  }
  const topicTitle = politicsArchiveTitle(
    archive.slot.positionKey,
    archive.slot.displayName,
    tNav,
  )
  return {
    title: `NewsCore — ${topicTitle}`,
    description: tCommon('meta.politicsTopicDescription', { topic: topicTitle }),
  }
}

/**
 * Public Politics topic archive: stories in a topic, newest first, paginated.
 *
 * @param props Route slug and optional `page` search param.
 * @returns Topic archive page, or a 404 when the slug is not a Politics row.
 */
export default async function PoliticsArchiveRoutePage({
  params,
  searchParams,
}: IPoliticsArchivePageProps): Promise<JSX.Element> {
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const page = parseArchivePage(searchParams.page)
  const archive = await loadPoliticsArchive({ slug, page })
  if (!archive) {
    notFound()
  }
  const tNav = await getTranslations('navigation')
  const topicTitle = politicsArchiveTitle(
    archive.slot.positionKey,
    archive.slot.displayName,
    tNav,
  )

  return (
    <>
      <main id="main-content" className="site-container py-8">
        <PoliticsCategoryPage
          slug={slug}
          topicTitle={topicTitle}
          connection={archive.connection}
        />
      </main>
      <StickyAdRibbon />
    </>
  )
}
