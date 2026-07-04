import type { Metadata } from 'next'

import { PoliticsPage } from '@/components/features/section-page'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketCode } from '@/lib/market-server'
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
  const market = getServerMarketCode()
  const initialFeed = await fetchPageFeed(market, 'politics')

  return (
    <main id="main-content" className="site-container py-8">
      <PoliticsPage initialFeed={initialFeed} />
    </main>
  )
}
