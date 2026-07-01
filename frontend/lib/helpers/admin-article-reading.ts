import type { IArticleDetail, IArticleMedia, ArticleStatusType } from '@/interfaces/article'
import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import {
  buildArticleGalleryMedia,
  type IGalleryMediaItem,
} from '@/lib/helpers/article-media-gallery'

/** Admin REST article detail shape returned by GET /articles/{id}. */
export interface IAdminArticleDetailOut {
  id: string
  title: string
  slug: string
  status: string
  author_name: string
  thumbnail_url: string | null
  video_url: string | null
  created_at: string
  published_at: string | null
  body: string
  tags: string[]
  category_id: string | null
  story_id: string | null
  media_ids: string[]
  category_ids?: string[]
  international_potential?: number | null
  max_image_count?: number
  view_count: number
}

const VALID_STATUSES: ArticleStatusType[] = ['draft', 'review', 'published', 'archived']

/**
 * Normalize a REST status string to a known article status.
 *
 * @param status Raw status from the admin API.
 * @returns A valid article status, defaulting to draft when unknown.
 */
function normalizedStatus(status: string): ArticleStatusType {
  return VALID_STATUSES.includes(status as ArticleStatusType)
    ? (status as ArticleStatusType)
    : 'draft'
}

/**
 * Map resolved media items to the frontend article media interface.
 *
 * @param items Resolved media from the admin API.
 * @returns Media assets for the reading view.
 */
function mapResolvedMedia(items: IGalleryMediaItem[]): IArticleMedia[] {
  return items.map((item) => ({
    id: item.id,
    url: item.url,
    fileType: item.fileType,
    width: item.width,
    height: item.height,
  }))
}

/**
 * Map an admin REST article detail plus resolved media to IArticleDetail.
 *
 * @param detail Article detail from GET /articles/{id}.
 * @param resolvedMedia Media items resolved from media_ids and legacy video_url.
 * @returns Article detail for ArticleHeader and ArticleBodyLayout.
 */
export function mapAdminArticleDetailToReadingView(
  detail: IAdminArticleDetailOut,
  resolvedMedia: IGalleryMediaItem[],
): IArticleDetail {
  const media = mapResolvedMedia(resolvedMedia)
  return {
    id: detail.id,
    title: detail.title,
    slug: detail.slug,
    summary: null,
    status: normalizedStatus(detail.status),
    authorName: detail.author_name,
    thumbnailUrl: detail.thumbnail_url,
    videoUrl: detail.video_url,
    createdAt: detail.created_at,
    publishedAt: detail.published_at,
    body: detail.body,
    tags: detail.tags ?? [],
    categoryId: detail.category_id,
    storyId: detail.story_id,
    mediaIds: detail.media_ids ?? [],
    media,
    viewCount: detail.view_count ?? 0,
    storyUpdates: [],
  }
}

/**
 * Fetch a full article for the editorial read overlay via the admin REST API.
 *
 * Works for draft, review, and published stories; the public GraphQL query
 * only returns published articles by slug.
 *
 * @param articleId Article id to load.
 * @returns Article detail ready for the public reading layout.
 * @throws Error When the article cannot be loaded.
 */
export async function fetchAdminArticleForReading(articleId: string): Promise<IArticleDetail> {
  const detail = await apiFetch<IAdminArticleDetailOut>(`${apiConfig.news}/articles/${articleId}`)
  const resolvedMedia = await buildArticleGalleryMedia({
    media_ids: detail.media_ids,
    thumbnail_url: detail.thumbnail_url,
    video_url: detail.video_url,
  })
  return mapAdminArticleDetailToReadingView(detail, resolvedMedia)
}
