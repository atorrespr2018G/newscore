import { useQuery } from '@apollo/client'
import { BREAKING_NEWS_QUERY } from '@/lib/graphql/operations'

/**
 * Fetches breaking news widget payload from GraphQL.
 */
export function useBreaking() {
  return useQuery(BREAKING_NEWS_QUERY, {
    ssr: false,
    select: (data) => data.breakingNews as Record<string, unknown> | null,
  })
}
