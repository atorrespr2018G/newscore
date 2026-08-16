'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { governmentPagePath } from '@/lib/helpers/section-labels'

interface IGovernmentCategoryPageProps {
  slug: string
  topicTitle: string
  connection: IArticleConnection
}

/**
 * Metro-style Government topic archive matching Sports › Basketball.
 *
 * @param props Topic slug, localized title, and paginated articles.
 * @returns Government topic archive page.
 */
export function GovernmentCategoryPage({
  slug,
  topicTitle,
  connection,
}: IGovernmentCategoryPageProps): JSX.Element {
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <SectionArchivePage
      title={topicTitle}
      parentHref="/government"
      parentLabel={tNav('sectionLabels.government')}
      basePath={governmentPagePath(slug)}
      connection={connection}
      emptyLabel={t('governmentArchiveEmpty')}
    />
  )
}
