import type { Metadata } from 'next'

import { GovernmentPage } from '@/components/features/homepage'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { GOVERNMENT_PAGE_NAME } from '@/lib/helpers/government-archive'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

/**
 * Document title and description for the Government landing page.
 *
 * @returns Metadata for `/government`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.government')}`,
    description: tCommon('meta.governmentDescription'),
  }
}

/**
 * Public Government landing: hero plus compact topic rows.
 *
 * @returns Government page.
 */
export default async function GovernmentRoutePage(): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    GOVERNMENT_PAGE_NAME,
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <GovernmentPage initialFeed={initialFeed} />
    </main>
  )
}
