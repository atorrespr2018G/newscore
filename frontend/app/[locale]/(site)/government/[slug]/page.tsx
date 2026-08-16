import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { GovernmentCategoryPage } from '@/components/features/government-category-page'
import { StickyAdRibbon } from '@/components/ui/sticky-ad-ribbon'
import type { IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { fetchCategoryArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { homepageSectionTitle, type SectionLabelTranslator } from '@/lib/helpers/section-labels'
import {
  GOVERNMENT_CATEGORY_PAGE_SIZE,
  GOVERNMENT_PAGE_NAME,
  findGovernmentArchiveSlot,
} from '@/lib/helpers/government-archive'
import { parseArchivePage } from '@/lib/helpers/sport-archive'
import { getTranslations } from '@/lib/locale-server'
import { getServerMarketScope } from '@/lib/market-server'

interface IGovernmentArchivePageProps {
  params: { slug: string }
  searchParams: { page?: string | string[] }
}

interface IGovernmentArchiveData {
  slot: IFeedSlot
  connection: IArticleConnection
}

/**
 * Localized Government topic heading for archive metadata and the page H1.
 *
 * @param slug Topic section slug.
 * @param displayName CMS slot display name for custom topics.
 * @param translate Navigation section-label translator.
 * @returns Localized or CMS topic title.
 */
function governmentArchiveTitle(
  slug: string,
  displayName: string | null,
  translate: SectionLabelTranslator,
): string {
  return homepageSectionTitle(slug, displayName, translate, GOVERNMENT_PAGE_NAME)
}

/**
 * Load a Government topic archive when the slug matches a compact Government row.
 *
 * @param options Topic slug and 1-indexed page.
 * @returns Slot plus paginated articles, or null when the slug is not a topic.
 */
async function loadGovernmentArchive(options: {
  slug: string
  page: number
}): Promise<IGovernmentArchiveData | null> {
  const scope = getServerMarketScope()
  const feed = await fetchPageFeed(
    scope.marketCode,
    GOVERNMENT_PAGE_NAME,
    scope.town,
    scope.county,
  )
  const slot = findGovernmentArchiveSlot(feed?.slots ?? [], options.slug)
  if (!slot) {
    return null
  }
  const connection = await fetchCategoryArticles({
    slug: options.slug,
    market: scope.marketCode,
    page: options.page,
    pageSize: GOVERNMENT_CATEGORY_PAGE_SIZE,
    town: scope.town,
    county: scope.county,
  })
  return { slot, connection }
}

/**
 * Build document title and description for a Government topic archive.
 *
 * @param props Route params used to resolve the topic label.
 * @returns Metadata for the topic archive page.
 */
export async function generateMetadata({
  params,
}: IGovernmentArchivePageProps): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const archive = await loadGovernmentArchive({ slug, page: 1 })
  if (!archive) {
    return { title: tCommon('notFound') }
  }
  const topicTitle = governmentArchiveTitle(slug, archive.slot.displayName, tNav)
  return {
    title: `NewsCore — ${topicTitle}`,
    description: tCommon('meta.governmentTopicDescription', { topic: topicTitle }),
  }
}

/**
 * Public Government topic archive: stories in a topic, newest first, paginated.
 *
 * @param props Route slug and optional `page` search param.
 * @returns Topic archive page, or a 404 when the slug is not a Government row.
 */
export default async function GovernmentArchiveRoutePage({
  params,
  searchParams,
}: IGovernmentArchivePageProps): Promise<JSX.Element> {
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const page = parseArchivePage(searchParams.page)
  const archive = await loadGovernmentArchive({ slug, page })
  if (!archive) {
    notFound()
  }
  const tNav = await getTranslations('navigation')
  const topicTitle = governmentArchiveTitle(slug, archive.slot.displayName, tNav)

  return (
    <>
      <main id="main-content" className="site-container py-8">
        <GovernmentCategoryPage
          slug={slug}
          topicTitle={topicTitle}
          connection={archive.connection}
        />
      </main>
      <StickyAdRibbon />
    </>
  )
}
