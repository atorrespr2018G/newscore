import type { IArticle, IArticleDetail } from '@/interfaces/article'
import type { IHomepageFeed } from '@/interfaces/feed'

interface IGraphqlArticle {
  id?: string | null
  slug?: string | null
  title?: string | null
  body?: string | null
  status?: string | null
  authorName?: string | null
  thumbnailUrl?: string | null
  createdAt?: string | null
  publishedAt?: string | null
  tags?: string[] | null
  categoryId?: string | null
  mediaIds?: string[] | null
  viewCount?: number | null
}

function normalizedString(value: string | null | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizedList(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizedStatus(value: string | null | undefined): IArticle['status'] {
  const status = normalizedString(value, 'published')
  return ['draft', 'review', 'published', 'archived'].includes(status)
    ? (status as IArticle['status'])
    : 'published'
}

/**
 * Map a GraphQL article to the frontend article interface.
 */
export function mapArticle(a: IGraphqlArticle): IArticle {
  return {
    id: normalizedString(a.id, 'unknown-article'),
    title: normalizedString(a.title, 'Untitled story'),
    slug: normalizedString(a.slug, 'newscore'),
    summary: a.body ?? null,
    status: normalizedStatus(a.status),
    authorName: normalizedString(a.authorName, 'NewsCore Staff'),
    thumbnailUrl: a.thumbnailUrl,
    createdAt: normalizedString(a.createdAt, new Date(0).toISOString()),
    publishedAt: a.publishedAt ?? null,
  }
}

/**
 * Map a GraphQL article detail to the frontend detail interface.
 */
export function mapArticleDetail(
  a: IGraphqlArticle & {
    body?: string | null
    tags?: string[] | null
    categoryId?: string | null
    mediaIds?: string[] | null
    viewCount?: number | null
  },
): IArticleDetail {
  return {
    ...mapArticle(a),
    body: normalizedString(a.body, ''),
    tags: normalizedList(a.tags),
    categoryId: a.categoryId ?? null,
    mediaIds: normalizedList(a.mediaIds),
    viewCount: typeof a.viewCount === 'number' ? a.viewCount : 0,
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
