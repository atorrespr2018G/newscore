import type { Metadata } from 'next'

import { CategoryLandingArchivePage } from '@/components/features/category-landing-archive-page'
import { StylePage } from '@/components/features/homepage'
import { fetchPageArchiveArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { STYLE_PAGE_NAME, STYLE_PAGE_PATH } from '@/lib/helpers/style-archive'
import { parseTechnologyArchivePage, TECHNOLOGY_ARCHIVE_PAGE_SIZE } from '@/lib/helpers/technology-archive'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

interface IStyleRoutePageProps {
  searchParams: { page?: string | string[] }
}

/**
 * Document title and description for the Style landing page.
 *
 * @returns Metadata for `/style`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.style')}`,
    description: tCommon('meta.styleDescription'),
  }
}

/**
 * Public Style landing: sports-style hero/Top Stories/Live plus a paginated
 * archive of stories placed on this page, newest first.
 *
 * @param props Optional `page` search param for archive pagination.
 * @returns Style page.
 */
export default async function StyleRoutePage({
  searchParams,
}: IStyleRoutePageProps): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const page = parseTechnologyArchivePage(searchParams.page)
  const [initialFeed, archive] = await Promise.all([
    fetchPageFeed(scope.marketCode, STYLE_PAGE_NAME, scope.town, scope.county),
    fetchPageArchiveArticles({
      page,
      pageSize: TECHNOLOGY_ARCHIVE_PAGE_SIZE,
      pageName: STYLE_PAGE_NAME,
    }),
  ])

  return (
    <main id="main-content" className="site-container py-8">
      <StylePage initialFeed={initialFeed} />
      <div className="mt-8">
        <CategoryLandingArchivePage connection={archive} basePath={STYLE_PAGE_PATH} />
      </div>
    </main>
  )
}
