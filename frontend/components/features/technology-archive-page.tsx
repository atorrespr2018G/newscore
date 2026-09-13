'use client'

import { CategoryLandingArchivePage } from '@/components/features/category-landing-archive-page'
import type { IArticleConnection } from '@/interfaces/article'
import { TECHNOLOGY_PAGE_PATH } from '@/lib/helpers/technology-archive'

interface ITechnologyArchivePageProps {
  connection: IArticleConnection
}

/**
 * Paginated Technology archive: 16 story cards per page, no Technology heading.
 *
 * @param props Paginated placed articles.
 * @returns Archive grid and pagination for the Technology landing page.
 */
export function TechnologyArchivePage({
  connection,
}: ITechnologyArchivePageProps): JSX.Element {
  return <CategoryLandingArchivePage connection={connection} basePath={TECHNOLOGY_PAGE_PATH} />
}
