import { print } from 'graphql'

import type { IArticleDetail } from '@/interfaces/article'
import type { IHomepageFeed } from '@/interfaces/feed'
import { graphqlUrl } from '@/lib/graphql/apollo-client'
import { mapArticleDetail, mapHomepageFeed } from '@/lib/graphql/mappers'
import { ARTICLE_BY_SLUG_QUERY, HOMEPAGE_FEED_QUERY } from '@/lib/graphql/operations'
import { toRegionCode } from '@/lib/region-code'

interface IGraphqlResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

/**
 * Server-side GraphQL fetch (plain fetch, no Apollo cache).
 */
export async function fetchGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(graphqlUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`)
  }

  const body = (await response.json()) as IGraphqlResponse<T>
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join('; '))
  }
  if (!body.data) {
    throw new Error('GraphQL response missing data')
  }
  return body.data
}

/**
 * Fetch homepage feed on the server for SSR.
 */
export async function fetchHomepageFeed(
  market: string,
  town?: string | null,
): Promise<IHomepageFeed | undefined> {
  return fetchPageFeed(market, 'homepage', town)
}

/**
 * Fetch a named page feed on the server for SSR.
 */
export async function fetchPageFeed(
  market: string,
  pageName: string,
  town?: string | null,
): Promise<IHomepageFeed | undefined> {
  try {
    const regionCode = toRegionCode(market, town)
    const data = await fetchGraphql<{ homepageFeed: Parameters<typeof mapHomepageFeed>[0]['homepageFeed'] }>(
      print(HOMEPAGE_FEED_QUERY),
      { market, town: town ?? null, regionCode, pageName },
    )
    return mapHomepageFeed(data)
  } catch (error) {
    console.error('Failed to fetch page feed', {
      market,
      pageName,
      town: town ?? null,
      error,
    })
    throw error
  }
}

/**
 * Fetch article detail on the server for SSR and metadata.
 */
export async function fetchArticleBySlug(
  slug: string,
  market: string,
): Promise<IArticleDetail | undefined> {
  try {
    const data = await fetchGraphql<{
      articleBySlug: Parameters<typeof mapArticleDetail>[0] | null
    }>(print(ARTICLE_BY_SLUG_QUERY), { slug, market })
    if (!data.articleBySlug) {
      return undefined
    }
    return mapArticleDetail(data.articleBySlug)
  } catch (error) {
    console.error('Failed to fetch article by slug', { slug, market, error })
    throw error
  }
}
