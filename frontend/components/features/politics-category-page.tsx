'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { politicsPagePath } from '@/lib/helpers/section-labels'

interface IPoliticsCategoryPageProps {
  slug: string
  topicTitle: string
  connection: IArticleConnection
}

/**
 * Metro-style Politics topic archive matching Health › Food.
 *
 * @param props Topic slug, localized title, and paginated articles.
 * @returns Politics topic archive page.
 */
export function PoliticsCategoryPage({
  slug,
  topicTitle,
  connection,
}: IPoliticsCategoryPageProps): JSX.Element {
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <SectionArchivePage
      title={topicTitle}
      parentHref="/politics"
      parentLabel={tNav('sectionLabels.politics')}
      basePath={politicsPagePath(slug)}
      connection={connection}
      emptyLabel={t('politicsArchiveEmpty')}
    />
  )
}
