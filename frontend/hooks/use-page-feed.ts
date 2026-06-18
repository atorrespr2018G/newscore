import { useQuery } from '@apollo/client'
import { useMarket } from '@/context/market-context'
import type { IHomepageFeed } from '@/interfaces/feed'
import { mapHomepageFeed } from '@/lib/graphql/mappers'
import { HOMEPAGE_FEED_QUERY } from '@/lib/graphql/operations'

/**
 * Fetches a named page feed for the active market from GraphQL.
 */
export function usePageFeed(pageName: string) {
  const { marketCode, town } = useMarket()
  const normalizedPageName = pageName.trim().toLowerCase()

  const result = useQuery(HOMEPAGE_FEED_QUERY, {
    variables: { market: marketCode, town: town ?? null, pageName: normalizedPageName },
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
