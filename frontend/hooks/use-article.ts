import { useQuery } from '@apollo/client'
import type { IArticleDetail } from '@/interfaces/article'
import { mapArticleDetail } from '@/lib/graphql/mappers'
import { ARTICLE_BY_SLUG_QUERY } from '@/lib/graphql/operations'

/**
 * Fetches a published article by slug from GraphQL.
 */
export function useArticle(slug: string) {
  return useQuery(ARTICLE_BY_SLUG_QUERY, {
    variables: { slug },
    skip: !slug,
    ssr: false,
    select: (data): IArticleDetail | undefined => {
      const article = data.articleBySlug
      if (!article) {
        return undefined
      }
      return mapArticleDetail(article)
    },
  })
}
