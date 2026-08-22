import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomTabCategoryPage } from '@/components/features/custom-tab-category-page'
import { StickyAdRibbon } from '@/components/ui/sticky-ad-ribbon'
import type { IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { listCustomTabs } from '@/lib/api/layout-client'
import { fetchCategoryArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import {
  CUSTOM_TAB_CATEGORY_PAGE_SIZE,
  findCustomTabArchiveSlot,
} from '@/lib/helpers/custom-tab-archive'
import { parseArchivePage } from '@/lib/helpers/sport-archive'
import { homepageSectionTitle } from '@/lib/helpers/section-labels'
import { getTranslations } from '@/lib/locale-server'
import { getServerMarketScope } from '@/lib/market-server'

interface ICustomSectionArchivePageProps {
  params: { section: string; slug: string }
  searchParams: { page?: string | string[] }
}

interface ICustomArchiveData {
  tabLabel: string
  pageName: string
  slot: IFeedSlot
  connection: IArticleConnection
}

/**
 * Load a custom-tab topic archive when the section and slug are valid.
 *
 * @param options Section slug, topic slug, and page index.
 * @returns Archive data, or null when not found.
 */
async function loadCustomArchive(options: {
  section: string
  slug: string
  page: number
}): Promise<ICustomArchiveData | null> {
  const pageName = decodeURIComponent(options.section).trim().toLowerCase()
  const topicSlug = decodeURIComponent(options.slug).trim().toLowerCase()
  const scope = getServerMarketScope()
  const tabs = await listCustomTabs(scope.marketCode).catch(() => [])
  const tab = tabs.find((item) => item.slug === pageName)
  if (!tab) {
    return null
  }
  const feed = await fetchPageFeed(
    scope.marketCode,
    pageName,
    scope.town,
    scope.county,
  )
  const slot = findCustomTabArchiveSlot(feed?.slots ?? [], topicSlug)
  if (!slot) {
    return null
  }
  const connection = await fetchCategoryArticles({
    slug: topicSlug,
    market: scope.marketCode,
    page: options.page,
    pageSize: CUSTOM_TAB_CATEGORY_PAGE_SIZE,
    town: scope.town,
    county: scope.county,
  })
  return {
    tabLabel: tab.label,
    pageName,
    slot,
    connection,
  }
}

/**
 * Build document title for a custom-tab topic archive.
 *
 * @param props Route params used to resolve the topic label.
 * @returns Metadata for the topic archive page.
 */
export async function generateMetadata({
  params,
}: ICustomSectionArchivePageProps): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const archive = await loadCustomArchive({
    section: params.section,
    slug: params.slug,
    page: 1,
  })
  if (!archive) {
    return { title: tCommon('notFound') }
  }
  const topicTitle = homepageSectionTitle(
    decodeURIComponent(params.slug).trim().toLowerCase(),
    archive.slot.displayName,
    undefined,
    archive.pageName,
  )
  return {
    title: `NewsCore — ${topicTitle}`,
    description: topicTitle,
  }
}

/**
 * Public custom-tab topic archive: stories in a topic, newest first, paginated.
 *
 * @param props Route section/slug and optional `page` search param.
 * @returns Topic archive page, or a 404 when not a custom-tab topic.
 */
export default async function CustomSectionArchiveRoutePage({
  params,
  searchParams,
}: ICustomSectionArchivePageProps): Promise<JSX.Element> {
  const page = parseArchivePage(searchParams.page)
  const archive = await loadCustomArchive({
    section: params.section,
    slug: params.slug,
    page,
  })
  if (!archive) {
    notFound()
  }
  const topicTitle = homepageSectionTitle(
    decodeURIComponent(params.slug).trim().toLowerCase(),
    archive.slot.displayName,
    undefined,
    archive.pageName,
  )

  return (
    <>
      <main id="main-content" className="site-container py-8">
        <CustomTabCategoryPage
          pageName={archive.pageName}
          tabLabel={archive.tabLabel}
          slug={decodeURIComponent(params.slug).trim().toLowerCase()}
          topicTitle={topicTitle}
          connection={archive.connection}
        />
      </main>
      <StickyAdRibbon />
    </>
  )
}
