import type { Metadata } from 'next'

import { SportsPage } from '@/components/features/homepage'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.sports')}`,
    description: tCommon('meta.sportsDescription'),
  }
}

export default async function SportsRoutePage(): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    'sports',
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <SportsPage initialFeed={initialFeed} />
    </main>
  )
}
