import type { Metadata } from 'next'

import { TechnologyPage } from '@/components/features/homepage'
import { TechnologyArchivePage } from '@/components/features/technology-archive-page'
import { fetchPageArchiveArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import {
  TECHNOLOGY_ARCHIVE_PAGE_SIZE,
  TECHNOLOGY_PAGE_NAME,
  parseTechnologyArchivePage,
} from '@/lib/helpers/technology-archive'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

interface ITechnologyRoutePageProps {
  searchParams: { page?: string | string[] }
}

/**
 * Document title and description for the Technology landing page.
 *
 * @returns Metadata for `/technology`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.technology')}`,
    description: tCommon('meta.technologyDescription'),
  }
}

/**
 * Public Technology landing: sports-style hero/Top Stories/Live plus a
 * paginated archive of stories placed on this page, newest first.
 *
 * @param props Optional `page` search param for archive pagination.
 * @returns Technology page.
 */
export default async function TechnologyRoutePage({
  searchParams,
}: ITechnologyRoutePageProps): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const page = parseTechnologyArchivePage(searchParams.page)
  const [initialFeed, archive] = await Promise.all([
    fetchPageFeed(scope.marketCode, TECHNOLOGY_PAGE_NAME, scope.town, scope.county),
    fetchPageArchiveArticles({
      page,
      pageSize: TECHNOLOGY_ARCHIVE_PAGE_SIZE,
    }),
  ])

  return (
    <main id="main-content" className="site-container py-8">
      <TechnologyPage initialFeed={initialFeed} />
      <div className="mt-8">
        <TechnologyArchivePage connection={archive} />
      </div>
    </main>
  )
}
