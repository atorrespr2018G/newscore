'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import {
  TECHNOLOGY_ARCHIVE_PAGE_SIZE,
  TECHNOLOGY_PAGE_PATH,
} from '@/lib/helpers/technology-archive'

interface ITechnologyArchivePageProps {
  connection: IArticleConnection
}

/**
 * Paginated Technology archive: 16 story cards per page, no Technology heading.
 *
 * Rendered on `/technology` itself. Stories come from placement pins, newest
 * first, not the homepage Technology category.
 *
 * @param props Paginated placed articles.
 * @returns Archive grid and pagination for the Technology landing page.
 */
export function TechnologyArchivePage({
  connection,
}: ITechnologyArchivePageProps): JSX.Element {
  const t = useTranslations('common')

  return (
    <SectionArchivePage
      title=""
      parentHref="/"
      parentLabel={t('backToHomepage')}
      basePath={TECHNOLOGY_PAGE_PATH}
      connection={connection}
      emptyLabel={t('technologyArchiveEmpty')}
      showBreadcrumb={false}
      showHeading={false}
      pageSize={TECHNOLOGY_ARCHIVE_PAGE_SIZE}
      bodyLayout="grid"
    />
  )
}
