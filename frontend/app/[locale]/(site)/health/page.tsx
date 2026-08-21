import type { Metadata } from 'next'

import { HealthPage } from '@/components/features/homepage'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { HEALTH_PAGE_NAME } from '@/lib/helpers/health-archive'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

/**
 * Document title and description for the Health landing page.
 *
 * @returns Metadata for `/health`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.finance')}`,
    description: tCommon('meta.healthDescription'),
  }
}

/**
 * Public Health landing: Sports-page hero plus compact topic rows.
 *
 * @returns Health page.
 */
export default async function HealthRoutePage(): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    HEALTH_PAGE_NAME,
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <HealthPage initialFeed={initialFeed} />
    </main>
  )
}
