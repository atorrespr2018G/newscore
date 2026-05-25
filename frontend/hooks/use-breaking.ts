import { useQuery } from '@apollo/client'
import { useMarket } from '@/context/market-context'
import { BREAKING_NEWS_QUERY } from '@/lib/graphql/operations'

/**
 * Fetches breaking news widget payload for the active market.
 */
export function useBreaking() {
  const { marketCode } = useMarket()

  const result = useQuery(BREAKING_NEWS_QUERY, {
    variables: { market: marketCode },
    ssr: false,
  })

  const breakingNews = (result.data?.breakingNews ?? null) as Record<string, unknown> | null

  return { ...result, data: breakingNews }
}
