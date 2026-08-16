import type { Metadata } from 'next'

import { BusinessPage } from '@/components/features/homepage'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { BUSINESS_PAGE_NAME } from '@/lib/helpers/business-archive'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

/**
 * Document title and description for the Economía landing page.
 *
 * @returns Metadata for `/business`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.business')}`,
    description: tCommon('meta.businessDescription'),
  }
}

/**
 * Public Economía landing: hero plus compact beat rows.
 *
 * @returns Economía page.
 */
export default async function BusinessRoutePage(): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    BUSINESS_PAGE_NAME,
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <BusinessPage initialFeed={initialFeed} />
    </main>
  )
}
