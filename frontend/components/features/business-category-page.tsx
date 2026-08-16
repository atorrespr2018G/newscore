'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { businessPagePath } from '@/lib/helpers/section-labels'

interface IBusinessCategoryPageProps {
  slug: string
  beatTitle: string
  connection: IArticleConnection
}

/**
 * Metro-style Economía beat archive matching Sports › Baseball.
 *
 * @param props Beat slug, localized title, and paginated articles.
 * @returns Economía beat archive page.
 */
export function BusinessCategoryPage({
  slug,
  beatTitle,
  connection,
}: IBusinessCategoryPageProps): JSX.Element {
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <SectionArchivePage
      title={beatTitle}
      parentHref="/business"
      parentLabel={tNav('sectionLabels.business')}
      basePath={businessPagePath(slug)}
      connection={connection}
      emptyLabel={t('businessArchiveEmpty')}
    />
  )
}
