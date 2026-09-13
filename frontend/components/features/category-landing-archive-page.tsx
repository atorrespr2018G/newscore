'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { TECHNOLOGY_ARCHIVE_PAGE_SIZE } from '@/lib/helpers/technology-archive'

interface ICategoryLandingArchivePageProps {
  connection: IArticleConnection
  /** Public path such as `/style`. */
  basePath: string
}

/**
 * Paginated landing-page archive: 16 story cards per page, no section heading.
 *
 * Stories come from placement pins, newest first, not the homepage category.
 *
 * @param props Paginated placed articles and the landing path.
 * @returns Archive grid and pagination for a category landing page.
 */
export function CategoryLandingArchivePage({
  connection,
  basePath,
}: ICategoryLandingArchivePageProps): JSX.Element {
  const t = useTranslations('common')

  return (
    <SectionArchivePage
      title=""
      parentHref="/"
      parentLabel={t('backToHomepage')}
      basePath={basePath}
      connection={connection}
      emptyLabel={t('technologyArchiveEmpty')}
      showBreadcrumb={false}
      showHeading={false}
      pageSize={TECHNOLOGY_ARCHIVE_PAGE_SIZE}
      bodyLayout="grid"
    />
  )
}
