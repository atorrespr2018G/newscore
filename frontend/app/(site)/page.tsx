import { Homepage } from '@/components/features/homepage'
import { fetchHomepageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketCode } from '@/lib/market-server'

export function generateMetadata() {
  return {
    title: 'NewsCore — Home',
    description: 'Top stories and latest updates.',
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
