import type { IArticle } from '@/interfaces/article'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'

const BALTIMORE_BRIDGE_TEST_IMAGE = '/images/homepage/baltimore-bridge.webp'

function searchableArticleText(article: {
  slug?: string | null
  title?: string | null
  summary?: string | null
  body?: string | null
}): string {
  return [article.slug, article.title, article.summary, article.body]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase()
}

function matchingOverrideSrc(article: {
  slug?: string | null
  title?: string | null
  summary?: string | null
  body?: string | null
}): string | undefined {
  const text = searchableArticleText(article)

  if (
    (text.includes('baltimore') && text.includes('bridge')) ||
    (text.includes('francis scott key') && text.includes('bridge')) ||
    (text.includes('dali') && text.includes('baltimore'))
  ) {
    return BALTIMORE_BRIDGE_TEST_IMAGE
  }

  return undefined
}

/**
 * Resolve the best image source for an article card or article page.
 *
 * @param article The article fields used to determine the image.
 * @returns A thumbnail URL, a local override, or a generated placeholder.
 */
export function articleImageSrc(article: {
  slug?: IArticle['slug'] | null
  title?: IArticle['title'] | null
  summary?: IArticle['summary'] | null
  body?: string | null
  thumbnailUrl?: IArticle['thumbnailUrl'] | null
}): string {
  return article.thumbnailUrl || matchingOverrideSrc(article) || placeholderImageDataUri(article.slug)
}

export function isDataUri(src: string): boolean {
  return src.startsWith('data:')
}
