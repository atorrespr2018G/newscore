import type { Metadata } from 'next'

import { CategoryLandingArchivePage } from '@/components/features/category-landing-archive-page'
import { TravelPage } from '@/components/features/homepage'
import { fetchPageArchiveArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { TRAVEL_PAGE_NAME, TRAVEL_PAGE_PATH } from '@/lib/helpers/travel-archive'
import { parseTechnologyArchivePage, TECHNOLOGY_ARCHIVE_PAGE_SIZE } from '@/lib/helpers/technology-archive'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

interface ITravelRoutePageProps {
  searchParams: { page?: string | string[] }
}

/**
 * Document title and description for the Travel landing page.
 *
 * @returns Metadata for `/travel`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.travel')}`,
    description: tCommon('meta.travelDescription'),
  }
}

/**
 * Public Travel landing: sports-style hero/Top Stories/Live plus a paginated
 * archive of stories placed on this page, newest first.
 *
 * @param props Optional `page` search param for archive pagination.
 * @returns Travel page.
 */
export default async function TravelRoutePage({
  searchParams,
}: ITravelRoutePageProps): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const page = parseTechnologyArchivePage(searchParams.page)
  const [initialFeed, archive] = await Promise.all([
    fetchPageFeed(scope.marketCode, TRAVEL_PAGE_NAME, scope.town, scope.county),
    fetchPageArchiveArticles({
      page,
      pageSize: TECHNOLOGY_ARCHIVE_PAGE_SIZE,
      pageName: TRAVEL_PAGE_NAME,
    }),
  ])

  return (
    <main id="main-content" className="site-container py-8">
      <TravelPage initialFeed={initialFeed} />
      <div className="mt-8">
        <CategoryLandingArchivePage connection={archive} basePath={TRAVEL_PAGE_PATH} />
      </div>
    </main>
  )
}
