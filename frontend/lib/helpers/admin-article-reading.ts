import type { IArticleDetail, IArticleMedia, ArticleStatusType } from '@/interfaces/article'
import { apiConfig } from '@/lib/api/config'
import { getMediaByIds } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'

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
  view_count: number
}

/** Resolved media item used when mapping admin detail to the reading view. */
interface IResolvedMediaItem {
  id: string
  url: string
  fileType: string
  width: number | null
  height: number | null
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
 * Include a legacy single video_url in the unified media gallery.
 *
 * Older articles store the lead video only in video_url (not media_ids), so it
 * has no media id to resolve. It is surfaced as an id-less gallery item so the
 * reading view can render the lead video.
 *
 * @param resolvedMedia Media resolved from the article's media_ids.
 * @param videoUrl The article's legacy single video_url, if any.
 * @returns Gallery items with the legacy lead video prepended when needed.
 */
export function withLegacyLeadVideo(
  resolvedMedia: IResolvedMediaItem[],
  videoUrl: string | null,
): IResolvedMediaItem[] {
  const leadVideo = videoUrl?.trim()
  if (!leadVideo || resolvedMedia.some((item) => item.url === leadVideo)) {
    return resolvedMedia
  }
  return [{ id: '', url: leadVideo, fileType: 'video', width: null, height: null }, ...resolvedMedia]
}

/**
 * Map resolved media items to the frontend article media interface.
 *
 * @param items Resolved media from the admin API.
 * @returns Media assets for the reading view.
 */
function mapResolvedMedia(items: IResolvedMediaItem[]): IArticleMedia[] {
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
  resolvedMedia: IResolvedMediaItem[],
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
 * Resolve media_ids from the admin API into gallery items.
 *
 * @param mediaIds Ordered media ids from the article detail.
 * @returns Resolved media in the requested order.
 */
async function resolveArticleMedia(mediaIds: string[]): Promise<IResolvedMediaItem[]> {
  if (mediaIds.length === 0) {
    return []
  }
  try {
    const assets = await getMediaByIds(mediaIds)
    return assets.map((asset) => ({
      id: asset.id,
      url: asset.url,
      fileType: asset.file_type,
      width: asset.width,
      height: asset.height,
    }))
  } catch {
    // Gallery media is optional for the read overlay; a failed batch lookup should
    // not block editors from reviewing draft copy before publish.
    return []
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
  const resolvedMedia = withLegacyLeadVideo(
    await resolveArticleMedia(detail.media_ids ?? []),
    detail.video_url,
  )
  return mapAdminArticleDetailToReadingView(detail, resolvedMedia)
}
