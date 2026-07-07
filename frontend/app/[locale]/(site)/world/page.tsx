import type { Metadata } from 'next'

import { WorldPage } from '@/components/features/section-page'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketScope } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

export async function generateMetadata(): Promise<Metadata> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')

  return {
    title: `NewsCore — ${tNav('sectionLabels.world')}`,
    description: tCommon('meta.worldDescription'),
  }
}

export default async function WorldRoutePage(): Promise<JSX.Element> {
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    'world',
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <WorldPage initialFeed={initialFeed} />
    </main>
  )
}
