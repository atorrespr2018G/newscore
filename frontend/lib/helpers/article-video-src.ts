import type { IArticle } from '@/interfaces/article'

type ArticleVideoFields = Pick<IArticle, 'videoUrl'>

/** Homepage hero teasers loop only this many seconds of the full clip. */
export const ARTICLE_TEASER_CLIP_SECONDS = 8

/**
 * Resolve the MP4 URL stored on the article, if any.
 */
export function articleVideoSrc(article: ArticleVideoFields): string | null {
  const url = article.videoUrl?.trim()
  return url ? url : null
}