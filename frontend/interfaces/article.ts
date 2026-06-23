/** Represents a published article from the Delivery API. */
export interface IArticle {
  id: string
  title: string
  slug: string
  summary: string | null
  status: ArticleStatusType
  authorName: string
  thumbnailUrl: string | null
  videoUrl: string | null
  createdAt: string
  publishedAt: string | null
}

/** A single image or video asset attached to an article. */
export interface IArticleMedia {
  id: string
  url: string
  fileType: string
  width: number | null
  height: number | null
}

/** Full article detail returned by Delivery API. */
export interface IArticleDetail extends IArticle {
  body: string
  tags: string[]
  categoryId: string | null
  mediaIds: string[]
  media: IArticleMedia[]
  viewCount: number
}

/** Possible publication lifecycle states. */
export type ArticleStatusType = 'draft' | 'review' | 'published' | 'archived'

