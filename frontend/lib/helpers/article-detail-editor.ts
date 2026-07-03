import type { Dispatch, SetStateAction } from 'react'
import { getMediaByIds } from '@/lib/api/media-client'
import { MIN_CATEGORY_COUNT } from '@/lib/helpers/category-selection'
import {
  MIN_BODY_TEXT_LENGTH,
  MIN_TITLE_LENGTH,
  htmlTextLength,
} from '@/lib/helpers/editor-curation'
import type { AdminTranslatorType, ILoadedMedia } from '@/interfaces/editor-article'

interface IArticleEditValidationInput {
  title: string
  body: string
  selectedCategoryIds: string[]
  uploadingMedia: boolean
}

interface IUploadMediaOptions {
  upload: (file: File) => Promise<{ id: string; url: string; file_type: 'image' | 'video' }>
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  setUploadingMedia: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string | null>>
  setIsDirty: Dispatch<SetStateAction<boolean>>
  errorMessage: string
}

/**
 * Validate the editable article fields before issuing a PATCH.
 *
 * @param input Current title, body, category selection, and upload state.
 * @param t Admin-namespace translator for localized messages.
 * @returns A localized error message, or null when the edits are valid.
 */
export function validateArticleEdits(
  input: IArticleEditValidationInput,
  t: AdminTranslatorType,
): string | null {
  if (input.uploadingMedia) {
    return t('editor.errors.waitForUploads')
  }
  if (input.selectedCategoryIds.length < MIN_CATEGORY_COUNT) {
    return t('editor.errors.selectCategory')
  }
  if (input.title.trim().length < MIN_TITLE_LENGTH) {
    return t('editor.errors.titleTooShort')
  }
  if (htmlTextLength(input.body) < MIN_BODY_TEXT_LENGTH) {
    return t('editor.errors.bodyTooShort')
  }
  return null
}

/**
 * Load and classify media assets for the article edit gallery.
 *
 * @param mediaIds Ordered media ids from the article detail.
 * @returns Resolved gallery items with file type classification.
 */
export async function loadArticleMedia(mediaIds: string[]): Promise<ILoadedMedia[]> {
  const assets = await getMediaByIds(mediaIds)
  return assets.map((asset) => ({ id: asset.id, url: asset.url, fileType: asset.file_type }))
}

/**
 * Include a legacy single ``video_url`` in the unified media gallery.
 *
 * Older articles store the lead video only in ``video_url`` (not ``media_ids``),
 * so it has no media id to resolve. It is surfaced as an id-less gallery item so
 * editors can see, reorder, or remove it; on save it is preserved via the
 * derived lead ``video_url`` as long as it remains the first video.
 *
 * @param resolvedMedia Media resolved from the article's media_ids.
 * @param videoUrl The article's legacy single video_url, if any.
 * @returns The gallery items, with the legacy lead video prepended when needed.
 */
export function withLegacyLeadVideo(
  resolvedMedia: ILoadedMedia[],
  videoUrl: string | null,
): ILoadedMedia[] {
  const leadVideo = videoUrl?.trim()
  if (!leadVideo || resolvedMedia.some((item) => item.url === leadVideo)) {
    return resolvedMedia
  }
  return [{ id: '', url: leadVideo, fileType: 'video' }, ...resolvedMedia]
}

/**
 * Upload one or more files and append them to the media gallery.
 *
 * Appending (rather than replacing) lets editors add multiple images and videos
 * across several picks; each appended item flags the form dirty.
 *
 * @param files Files selected from a picker, or null.
 * @param options Uploader, state setters, and the localized error message.
 * @returns Resolves once every file has uploaded or an error is surfaced.
 */
export async function uploadMediaInto(
  files: FileList | null,
  options: IUploadMediaOptions,
): Promise<void> {
  if (!files?.length) {
    return
  }
  options.setUploadingMedia(true)
  options.setError(null)
  try {
    const uploaded: ILoadedMedia[] = []
    for (const file of Array.from(files)) {
      const media = await options.upload(file)
      uploaded.push({ id: media.id, url: media.url, fileType: media.file_type })
    }
    options.setMediaItems((current) => [...current, ...uploaded])
    options.setIsDirty(true)
  } catch (err) {
    options.setError(err instanceof Error ? err.message : options.errorMessage)
  } finally {
    options.setUploadingMedia(false)
  }
}
