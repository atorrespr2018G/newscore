import type { IArticle } from '@/interfaces/article'

type ArticleVideoFields = Pick<IArticle, 'videoUrl'>

type ArticleCardPreviewFields = Pick<IArticle, 'videoUrl' | 'thumbnailUrl'>

/** Homepage hero teasers loop only this many seconds of the full clip. */
export const ARTICLE_TEASER_CLIP_SECONDS = 8

/**
 * Resolve the MP4 URL stored on the article, if any.
 */
export function articleVideoSrc(article: ArticleVideoFields): string | null {
  const url = article.videoUrl?.trim()
  return url ? url : null
}

/**
 * Resolve the video URL a story card should show a still frame from.
 *
 * Category and section cards cannot autoplay video, so a movie-only story
 * would otherwise fall back to the generic placeholder image. When such a
 * story has a video but no explicit thumbnail, return the video URL so the
 * card can render its first frame instead of the placeholder.
 *
 * @param article Article subset with optional video and thumbnail URLs.
 * @returns The video URL to preview, or null when an image should be shown.
 */
export function articleCardPreviewVideoSrc(
  article: ArticleCardPreviewFields,
): string | null {
  // An explicit thumbnail always wins; only movie-only stories fall back to a frame.
  if (article.thumbnailUrl?.trim()) {
    return null
  }
  return articleVideoSrc(article)
}