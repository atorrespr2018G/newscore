'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { worldPagePath } from '@/lib/helpers/section-labels'

interface IWorldRegionPageProps {
  slug: string
  regionTitle: string
  connection: IArticleConnection
}

/**
 * Metro-style World region archive matching Sports › Baseball.
 *
 * @param props Region slug, localized title, and paginated articles.
 * @returns World region archive page.
 */
export function WorldRegionPage({
  slug,
  regionTitle,
  connection,
}: IWorldRegionPageProps): JSX.Element {
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  return (
    <SectionArchivePage
      title={regionTitle}
      parentHref="/world"
      parentLabel={tNav('sectionLabels.world')}
      basePath={worldPagePath(slug)}
      connection={connection}
      emptyLabel={t('worldArchiveEmpty')}
    />
  )
}
