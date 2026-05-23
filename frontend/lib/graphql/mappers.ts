import type { IArticle, IArticleDetail } from '@/interfaces/article'
import type { IHomepageFeed } from '@/interfaces/feed'

interface IGraphqlArticle {
  id: string
  slug: string
  title: string
  status: string
  authorName: string
  thumbnailUrl: string | null
  createdAt: string
  publishedAt: string | null
}

/**
 * Map a GraphQL article to the frontend article interface.
 */
export function mapArticle(a: IGraphqlArticle): IArticle {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    status: a.status as IArticle['status'],
    authorName: a.authorName,
    thumbnailUrl: a.thumbnailUrl,
    createdAt: a.createdAt,
    publishedAt: a.publishedAt,
  }
}

/**
 * Map a GraphQL article detail to the frontend detail interface.
 */
export function mapArticleDetail(
  a: IGraphqlArticle & {
    body: string
    tags: string[]
    categoryId: string | null
    mediaIds: string[]
    viewCount: number
  },
): IArticleDetail {
  return {
    ...mapArticle(a),
    body: a.body,
    tags: a.tags,
    categoryId: a.categoryId,
    mediaIds: a.mediaIds,
    viewCount: a.viewCount,
  }
}

/**
 * Map homepage feed query data to IHomepageFeed.
 */
export function mapHomepageFeed(data: {
  homepageFeed: {
    layoutId: string | null
    pageName: string
    slots: Array<{
      id: string
      positionKey: string
      displayName: string | null
      presentationType: string
      contentType: string
      articles: IGraphqlArticle[]
    }>
  }
}): IHomepageFeed {
  const feed = data.homepageFeed
  return {
    layoutId: feed.layoutId ?? '',
    pageName: feed.pageName,
    slots: feed.slots.map((slot) => ({
      id: slot.id,
      positionKey: slot.positionKey,
      displayName: slot.displayName,
      presentationType: slot.presentationType,
      contentType: slot.contentType,
      articles: slot.articles.map(mapArticle),
    })),
  }
}
