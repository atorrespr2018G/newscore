import type { Metadata } from 'next'

import { PoliticsPage } from '@/components/features/section-page'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.politics')}`,
    description: tCommon('meta.politicsDescription'),
  }
}

export default async function PoliticsRoutePage(): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    'politics',
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <PoliticsPage initialFeed={initialFeed} />
    </main>
  )
}
