import type { Metadata } from 'next'

import { Homepage } from '@/components/features/homepage'
import { fetchHomepageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketCode } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')

  return {
    title: t('meta.homeTitle'),
    description: t('meta.homeDescription'),
  }
}

export default async function HomePage(): Promise<JSX.Element> {
  const market = getServerMarketCode()
  const initialFeed = await fetchHomepageFeed(market)

  return (
    <main id="main-content" className="site-container py-8">
      <Homepage initialFeed={initialFeed} />
    </main>
  )
}
