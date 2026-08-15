import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SportCategoryPage } from '@/components/features/sport-category-page'
import type { IArticleConnection } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { fetchCategoryArticles, fetchPageFeed } from '@/lib/graphql/server-fetch'
import { homepageSectionTitle, type SectionLabelTranslator } from '@/lib/helpers/section-labels'
import {
  findSportArchiveSlot,
  parseArchivePage,
  SPORT_CATEGORY_PAGE_SIZE,
  SPORTS_PAGE_NAME,
} from '@/lib/helpers/sport-archive'
import { getTranslations } from '@/lib/locale-server'
import { getServerMarketScope } from '@/lib/market-server'

interface ISportArchivePageProps {
  params: { slug: string }
  searchParams: { page?: string | string[] }
}

interface ISportArchiveData {
  slot: IFeedSlot
  connection: IArticleConnection
}

/**
 * Localized sport heading for archive metadata and the page H1.
 *
 * @param slug Sport section slug.
 * @param displayName CMS slot display name for custom sports.
 * @param translate Navigation section-label translator.
 * @returns Localized or CMS sport title.
 */
function sportArchiveTitle(
  slug: string,
  displayName: string | null,
  translate: SectionLabelTranslator,
): string {
  return homepageSectionTitle(slug, displayName, translate, SPORTS_PAGE_NAME)
}

/**
 * Load a sport archive when the slug matches a compact Sports-page row.
 *
 * @param options Sport slug and 1-indexed page.
 * @returns Slot plus paginated articles, or null when the slug is not a sport.
 */
async function loadSportArchive(options: {
  slug: string
  page: number
}): Promise<ISportArchiveData | null> {
  const scope = getServerMarketScope()
  const feed = await fetchPageFeed(scope.marketCode, SPORTS_PAGE_NAME, scope.town, scope.county)
  const slot = findSportArchiveSlot(feed?.slots ?? [], options.slug)
  if (!slot) {
    return null
  }
  const connection = await fetchCategoryArticles({
    slug: options.slug,
    market: scope.marketCode,
    page: options.page,
    pageSize: SPORT_CATEGORY_PAGE_SIZE,
    town: scope.town,
    county: scope.county,
  })
  return { slot, connection }
}

/**
 * Build document title and description for a sport archive.
 *
 * @param props Route params used to resolve the sport label.
 * @returns Metadata for the sport archive page.
 */
export async function generateMetadata({ params }: ISportArchivePageProps): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const archive = await loadSportArchive({ slug, page: 1 })
  if (!archive) {
    return { title: tCommon('notFound') }
  }
  const sportTitle = sportArchiveTitle(slug, archive.slot.displayName, tNav)
  return {
    title: `NewsCore — ${sportTitle}`,
    description: tCommon('meta.sportDescription', { sport: sportTitle }),
  }
}

/**
 * Public sport archive: all stories in a sport, newest first, paginated.
 *
 * @param props Route slug and optional `page` search param.
 * @returns Sport archive page, or a 404 when the slug is not a sport.
 */
export default async function SportArchiveRoutePage({
  params,
  searchParams,
}: ISportArchivePageProps): Promise<JSX.Element> {
  const slug = decodeURIComponent(params.slug).trim().toLowerCase()
  const page = parseArchivePage(searchParams.page)
  const archive = await loadSportArchive({ slug, page })
  if (!archive) {
    notFound()
  }
  const tNav = await getTranslations('navigation')
  const sportTitle = sportArchiveTitle(slug, archive.slot.displayName, tNav)

  return (
    <main id="main-content" className="site-container py-8">
      <SportCategoryPage slug={slug} sportTitle={sportTitle} connection={archive.connection} />
    </main>
  )
}
