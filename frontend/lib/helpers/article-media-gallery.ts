import { getMediaByIds } from '@/lib/api/media-client'
import type { ILoadedMedia } from '@/interfaces/editor-article'

/** Resolved gallery item used by the reading view and edit form. */
export interface IGalleryMediaItem {
  id: string
  url: string
  fileType: 'image' | 'video'
  width: number | null
  height: number | null
}

/** Article fields needed to assemble a full pictures-and-videos gallery. */
export interface IArticleMediaFields {
  media_ids?: string[]
  thumbnail_url?: string | null
  video_url?: string | null
}

/**
 * Resolve ordered media ids into gallery items via the admin REST API.
 *
 * @param mediaIds Ordered media ids from the article detail.
 * @returns Resolved gallery items in the requested order.
 * @throws ApiError When the batch media request fails.
 */
export async function resolveMediaIdsToGalleryItems(mediaIds: string[]): Promise<IGalleryMediaItem[]> {
  if (mediaIds.length === 0) {
    return []
  }
  const assets = await getMediaByIds(mediaIds)
  return assets.map((asset) => ({
    id: asset.id,
    url: asset.url,
    fileType: asset.file_type,
    width: asset.width,
    height: asset.height,
  }))
}

/**
 * Prepend a legacy lead ``video_url`` when it is not already in the gallery.
 *
 * @param items Media resolved from ``media_ids``.
 * @param videoUrl Legacy single-video field from the article document.
 * @returns Gallery items with the lead video surfaced first when needed.
 */
export function appendLegacyLeadVideo(
  items: IGalleryMediaItem[],
  videoUrl: string | null,
): IGalleryMediaItem[] {
  const leadVideo = videoUrl?.trim()
  if (!leadVideo || items.some((item) => item.url === leadVideo)) {
    return items
  }
  return [
    { id: '', url: leadVideo, fileType: 'video', width: null, height: null },
    ...items,
  ]
}

/**
 * Prepend a legacy ``thumbnail_url`` image when no pictures were resolved.
 *
 * Seed and reporter stories often store the hero frame only on ``thumbnail_url``
 * while ``media_ids`` stays empty; without this fallback the popup gallery is blank
 * even though the homepage card shows the picture.
 *
 * @param items Gallery items after media-id and legacy-video normalization.
 * @param thumbnailUrl Hero image URL from the article document.
 * @returns Gallery items including the thumbnail when no image is present.
 */
export function appendThumbnailLeadImage(
  items: IGalleryMediaItem[],
  thumbnailUrl: string | null,
): IGalleryMediaItem[] {
  const thumb = thumbnailUrl?.trim()
  if (!thumb || items.some((item) => item.url === thumb)) {
    return items
  }
  const hasImage = items.some((item) => item.fileType === 'image')
  if (!hasImage) {
    return [
      { id: '', url: thumb, fileType: 'image', width: null, height: null },
      ...items,
    ]
  }
  return items
}

/**
 * Build the full article media gallery from ids plus legacy thumbnail/video fields.
 *
 * @param fields Article media fields from the admin REST detail payload.
 * @returns Ordered gallery items for preview and edit surfaces.
 */
export async function buildArticleGalleryMedia(
  fields: IArticleMediaFields,
): Promise<IGalleryMediaItem[]> {
  let items: IGalleryMediaItem[] = []
  const mediaIds = fields.media_ids ?? []
  if (mediaIds.length > 0) {
    try {
      items = await resolveMediaIdsToGalleryItems(mediaIds)
    } catch {
      // Fall back to thumbnail_url / video_url when batch media lookup fails.
      items = []
    }
  }
  return appendThumbnailLeadImage(
    appendLegacyLeadVideo(items, fields.video_url ?? null),
    fields.thumbnail_url ?? null,
  )
}

/**
 * Map gallery items into the edit-form media list shape.
 *
 * @param items Resolved gallery items.
 * @returns Media rows for the editor upload/reorder UI.
 */
export function galleryItemsToLoadedMedia(items: IGalleryMediaItem[]): ILoadedMedia[] {
  return items.map((item) => ({
    id: item.id,
    url: item.url,
    fileType: item.fileType,
  }))
}
