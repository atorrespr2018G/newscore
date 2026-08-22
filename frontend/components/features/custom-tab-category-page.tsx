'use client'

import { useTranslations } from 'next-intl'

import { SectionArchivePage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import { customTabPagePath, customTabTopicPath } from '@/lib/helpers/custom-tab-archive'

interface ICustomTabCategoryPageProps {
  pageName: string
  tabLabel: string
  slug: string
  topicTitle: string
  connection: IArticleConnection
}

/**
 * Topic archive for an admin-created custom tab (Entertainment-style).
 *
 * @param props Tab metadata, topic slug/title, and paginated articles.
 * @returns Custom tab topic archive page.
 */
export function CustomTabCategoryPage({
  pageName,
  tabLabel,
  slug,
  topicTitle,
  connection,
}: ICustomTabCategoryPageProps): JSX.Element {
  const t = useTranslations('common')

  return (
    <SectionArchivePage
      title={topicTitle}
      parentHref={customTabPagePath(pageName)}
      parentLabel={tabLabel}
      basePath={customTabTopicPath(pageName, slug)}
      connection={connection}
      emptyLabel={t('customTabArchiveEmpty')}
    />
  )
}
