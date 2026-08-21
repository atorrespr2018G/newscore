'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { healthPagePath } from '@/lib/helpers/section-labels'

interface IHealthCategoryPageProps {
  slug: string
  topicTitle: string
  connection: IArticleConnection
}

/**
 * Metro-style Health topic archive matching Sports › Basketball.
 *
 * @param props Topic slug, localized title, and paginated articles.
 * @returns Health topic archive page.
 */
export function HealthCategoryPage({
  slug,
  topicTitle,
  connection,
}: IHealthCategoryPageProps): JSX.Element {
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <SectionArchivePage
      title={topicTitle}
      parentHref="/health"
      parentLabel={tNav('sectionLabels.finance')}
      basePath={healthPagePath(slug)}
      connection={connection}
      emptyLabel={t('healthArchiveEmpty')}
    />
  )
}
