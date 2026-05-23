import { useQuery } from '@apollo/client'
import { useMarket } from '@/context/market-context'
import type { IHomepageFeed } from '@/interfaces/feed'
import { mapHomepageFeed } from '@/lib/graphql/mappers'
import { HOMEPAGE_FEED_QUERY } from '@/lib/graphql/operations'

/**
 * Fetches the homepage feed for the active market from GraphQL.
 */
export function useFeed() {
  const { marketCode, town } = useMarket()

  const result = useQuery(HOMEPAGE_FEED_QUERY, {
    variables: { market: marketCode, town: town ?? null },
    pollInterval: 1000 * 15,
    fetchPolicy: 'cache-and-network',
    ssr: false,
  })

  const feed: IHomepageFeed | undefined = result.data?.homepageFeed
    ? mapHomepageFeed(result.data)
    : undefined

  const loading = result.loading && feed === undefined

  return { ...result, data: feed, loading }
}
