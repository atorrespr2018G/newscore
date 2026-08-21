'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { entertainmentPagePath } from '@/lib/helpers/section-labels'

interface IEntertainmentCategoryPageProps {
  slug: string
  topicTitle: string
  connection: IArticleConnection
}

/**
 * Metro-style Entertainment topic archive matching Sports › Basketball.
 *
 * @param props Topic slug, localized title, and paginated articles.
 * @returns Entertainment topic archive page.
 */
export function EntertainmentCategoryPage({
  slug,
  topicTitle,
  connection,
}: IEntertainmentCategoryPageProps): JSX.Element {
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <SectionArchivePage
      title={topicTitle}
      parentHref="/entertainment"
      parentLabel={tNav('sectionLabels.entertainment')}
      basePath={entertainmentPagePath(slug)}
      connection={connection}
      emptyLabel={t('entertainmentArchiveEmpty')}
    />
  )
}
