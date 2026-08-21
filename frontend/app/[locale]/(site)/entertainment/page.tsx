import type { Metadata } from 'next'

import { EntertainmentPage } from '@/components/features/homepage'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { ENTERTAINMENT_PAGE_NAME } from '@/lib/helpers/entertainment-archive'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

/**
 * Document title and description for the Entertainment landing page.
 *
 * @returns Metadata for `/entertainment`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.entertainment')}`,
    description: tCommon('meta.entertainmentDescription'),
  }
}

/**
 * Public Entertainment landing: Sports-page hero plus compact topic rows.
 *
 * @returns Entertainment page.
 */
export default async function EntertainmentRoutePage(): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    ENTERTAINMENT_PAGE_NAME,
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <EntertainmentPage initialFeed={initialFeed} />
    </main>
  )
}
