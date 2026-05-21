/** Represents a published article from the Delivery API. */
export interface IArticle {
  id: string
  title: string
  slug: string
  status: ArticleStatusType
  authorName: string
  thumbnailUrl: string | null
  createdAt: string
  publishedAt: string | null
}

/** Full article detail returned by Delivery API. */
export interface IArticleDetail extends IArticle {
  body: string
  tags: string[]
  categoryId: string | null
  mediaIds: string[]
  viewCount: number
}

/** Possible publication lifecycle states. */
export type ArticleStatusType = 'draft' | 'review' | 'published' | 'archived'

