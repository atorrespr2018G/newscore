import { useQuery } from '@apollo/client'
import { useMarket } from '@/context/market-context'
import type { IArticleDetail } from '@/interfaces/article'
import { mapArticleDetail } from '@/lib/graphql/mappers'
import { ARTICLE_BY_SLUG_QUERY } from '@/lib/graphql/operations'

/**
 * Fetches a published article by slug for the active market.
 */
export function useArticle(slug: string) {
  const { marketCode } = useMarket()

  const result = useQuery(ARTICLE_BY_SLUG_QUERY, {
    variables: { slug, market: marketCode },
    skip: !slug,
    ssr: false,
  })

  const article: IArticleDetail | undefined = result.data?.articleBySlug
    ? mapArticleDetail(result.data.articleBySlug)
    : undefined

  const loading = result.loading && article === undefined

  return { ...result, data: article, loading }
}
