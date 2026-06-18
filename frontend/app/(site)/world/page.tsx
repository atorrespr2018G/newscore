import { WorldPage } from '@/components/features/section-page'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketCode } from '@/lib/market-server'

export function generateMetadata() {
  return {
    title: 'NewsCore — World',
    description: 'World news and latest updates.',
  }
}

export default async function WorldRoutePage(): Promise<JSX.Element> {
  const market = getServerMarketCode()
  const initialFeed = await fetchPageFeed(market, 'world')

  return (
    <main id="main-content" className="site-container py-8">
      <WorldPage initialFeed={initialFeed} />
    </main>
  )
}
