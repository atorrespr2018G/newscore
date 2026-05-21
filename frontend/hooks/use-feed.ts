import { useQuery } from '@apollo/client'
import type { IHomepageFeed } from '@/interfaces/feed'
import { mapHomepageFeed } from '@/lib/graphql/mappers'
import { HOMEPAGE_FEED_QUERY } from '@/lib/graphql/operations'

/**
 * Fetches the homepage feed from the federated GraphQL API.
 */
export function useFeed() {
  const result = useQuery(HOMEPAGE_FEED_QUERY, {
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
