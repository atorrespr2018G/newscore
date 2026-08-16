import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BusinessCategoryPage } from '@/components/features/business-category-page'
import { StickyAdRibbon } from '@/components/ui/sticky-ad-ribbon'
import type { IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { fetchCategoryArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { homepageSectionTitle, type SectionLabelTranslator } from '@/lib/helpers/section-labels'
import {
  BUSINESS_CATEGORY_PAGE_SIZE,
  BUSINESS_PAGE_NAME,
  findBusinessArchiveSlot,
} from '@/lib/helpers/business-archive'
import { parseArchivePage } from '@/lib/helpers/sport-archive'
import { getTranslations } from '@/lib/locale-server'
import { getServerMarketScope } from '@/lib/market-server'

interface IBusinessArchivePageProps {
  params: { slug: string }
  searchParams: { page?: string | string[] }
}

interface IBusinessArchiveData {
  slot: IFeedSlot
  connection: IArticleConnection
}

/**
 * Localized Economía beat heading for archive metadata and the page H1.
 *
 * @param slug Beat section slug.
 * @param displayName CMS slot display name for custom beats.
 * @param translate Navigation section-label translator.
 * @returns Localized or CMS beat title.
 */
function businessArchiveTitle(
  slug: string,
  displayName: string | null,
  translate: SectionLabelTranslator,
): string {
  return homepageSectionTitle(slug, displayName, translate, BUSINESS_PAGE_NAME)
}

/**
 * Load an Economía beat archive when the slug matches a compact Business-page row.
 *
 * @param options Beat slug and 1-indexed page.
 * @returns Slot plus paginated articles, or null when the slug is not a beat.
 */
async function loadBusinessArchive(options: {
  slug: string
  page: number
}): Promise<IBusinessArchiveData | null> {
  const scope = getServerMarketScope()
  const feed = await fetchPageFeed(scope.marketCode, BUSINESS_PAGE_NAME, scope.town, scope.county)
  const slot = findBusinessArchiveSlot(feed?.slots ?? [], options.slug)
  if (!slot) {
    return null
  }
  const connection = await fetchCategoryArticles({
    slug: options.slug,
    market: scope.marketCode,
    page: options.page,
    pageSize: BUSINESS_CATEGORY_PAGE_SIZE,
    town: scope.town,
    county: scope.county,
  })
  return { slot, connection }
}

/**
 * Build document title and description for an Economía beat archive.
 *
 * @param props Route params used to resolve the beat label.
 * @returns Metadata for the beat archive page.
 */
export async function generateMetadata({ params }: IBusinessArchivePageProps): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const archive = await loadBusinessArchive({ slug, page: 1 })
  if (!archive) {
    return { title: tCommon('notFound') }
  }
  const beatTitle = businessArchiveTitle(slug, archive.slot.displayName, tNav)
  return {
    title: `NewsCore — ${beatTitle}`,
    description: tCommon('meta.businessBeatDescription', { beat: beatTitle }),
  }
}

/**
 * Public Economía beat archive: stories in a beat, newest first, paginated.
 *
 * @param props Route slug and optional `page` search param.
 * @returns Beat archive page, or a 404 when the slug is not an Economía row.
 */
export default async function BusinessArchiveRoutePage({
  params,
  searchParams,
}: IBusinessArchivePageProps): Promise<JSX.Element> {
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const page = parseArchivePage(searchParams.page)
  const archive = await loadBusinessArchive({ slug, page })
  if (!archive) {
    notFound()
  }
  const tNav = await getTranslations('navigation')
  const beatTitle = businessArchiveTitle(slug, archive.slot.displayName, tNav)

  return (
    <>
      <main id="main-content" className="site-container py-8">
        <BusinessCategoryPage slug={slug} beatTitle={beatTitle} connection={archive.connection} />
      </main>
      <StickyAdRibbon />
    </>
  )
}
