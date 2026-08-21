import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EntertainmentCategoryPage } from '@/components/features/entertainment-category-page'
import { StickyAdRibbon } from '@/components/ui/sticky-ad-ribbon'
import type { IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { fetchCategoryArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { homepageSectionTitle, type SectionLabelTranslator } from '@/lib/helpers/section-labels'
import {
  ENTERTAINMENT_CATEGORY_PAGE_SIZE,
  ENTERTAINMENT_PAGE_NAME,
  findEntertainmentArchiveSlot,
} from '@/lib/helpers/entertainment-archive'
import { parseArchivePage } from '@/lib/helpers/sport-archive'
import { getTranslations } from '@/lib/locale-server'
import { getServerMarketScope } from '@/lib/market-server'

interface IEntertainmentArchivePageProps {
  params: { slug: string }
  searchParams: { page?: string | string[] }
}

interface IEntertainmentArchiveData {
  slot: IFeedSlot
  connection: IArticleConnection
}

/**
 * Localized Entertainment topic heading for archive metadata and the page H1.
 *
 * @param slug Topic section slug.
 * @param displayName CMS slot display name for custom topics.
 * @param translate Navigation section-label translator.
 * @returns Localized or CMS topic title.
 */
function entertainmentArchiveTitle(
  slug: string,
  displayName: string | null,
  translate: SectionLabelTranslator,
): string {
  return homepageSectionTitle(slug, displayName, translate, ENTERTAINMENT_PAGE_NAME)
}

/**
 * Load an Entertainment topic archive when the slug matches a compact row.
 *
 * @param options Topic slug and 1-indexed page.
 * @returns Slot plus paginated articles, or null when the slug is not a topic.
 */
async function loadEntertainmentArchive(options: {
  slug: string
  page: number
}): Promise<IEntertainmentArchiveData | null> {
  const scope = getServerMarketScope()
  const feed = await fetchPageFeed(
    scope.marketCode,
    ENTERTAINMENT_PAGE_NAME,
    scope.town,
    scope.county,
  )
  const slot = findEntertainmentArchiveSlot(feed?.slots ?? [], options.slug)
  if (!slot) {
    return null
  }
  const connection = await fetchCategoryArticles({
    slug: options.slug,
    market: scope.marketCode,
    page: options.page,
    pageSize: ENTERTAINMENT_CATEGORY_PAGE_SIZE,
    town: scope.town,
    county: scope.county,
  })
  return { slot, connection }
}

/**
 * Build document title and description for an Entertainment topic archive.
 *
 * @param props Route params used to resolve the topic label.
 * @returns Metadata for the topic archive page.
 */
export async function generateMetadata({
  params,
}: IEntertainmentArchivePageProps): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const archive = await loadEntertainmentArchive({ slug, page: 1 })
  if (!archive) {
    return { title: tCommon('notFound') }
  }
  const topicTitle = entertainmentArchiveTitle(slug, archive.slot.displayName, tNav)
  return {
    title: `NewsCore — ${topicTitle}`,
    description: tCommon('meta.entertainmentTopicDescription', { topic: topicTitle }),
  }
}

/**
 * Public Entertainment topic archive: stories in a topic, newest first, paginated.
 *
 * @param props Route slug and optional `page` search param.
 * @returns Topic archive page, or a 404 when the slug is not an Entertainment row.
 */
export default async function EntertainmentArchiveRoutePage({
  params,
  searchParams,
}: IEntertainmentArchivePageProps): Promise<JSX.Element> {
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const page = parseArchivePage(searchParams.page)
  const archive = await loadEntertainmentArchive({ slug, page })
  if (!archive) {
    notFound()
  }
  const tNav = await getTranslations('navigation')
  const topicTitle = entertainmentArchiveTitle(slug, archive.slot.displayName, tNav)

  return (
    <>
      <main id="main-content" className="site-container py-8">
        <EntertainmentCategoryPage
          slug={slug}
          topicTitle={topicTitle}
          connection={archive.connection}
        />
      </main>
      <StickyAdRibbon />
    </>
  )
}
