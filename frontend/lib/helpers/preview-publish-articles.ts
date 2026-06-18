import type { IArticle } from '@/interfaces/article'
import type { IHomepageFeed } from '@/interfaces/feed'

const UNPUBLISHED_ARTICLE_STATUSES = new Set<IArticle['status']>(['draft', 'review'])

/**
 * Collect unpublished articles shown in a homepage preview feed.
 *
 * @param feed Homepage preview feed.
 * @returns Unique articles that are not yet published.
 */
export function collectUnpublishedPreviewArticles(feed: IHomepageFeed | null): IArticle[] {
  if (!feed) {
    return []
  }

  const articlesById = new Map<string, IArticle>()
  for (const slot of feed.slots) {
    for (const article of slot.articles) {
      if (UNPUBLISHED_ARTICLE_STATUSES.has(article.status)) {
        articlesById.set(article.id, article)
      }
    }
  }

  return [...articlesById.values()]
}
