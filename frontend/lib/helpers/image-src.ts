import type { IArticle } from '@/interfaces/article'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'

export function articleImageSrc(article: Pick<IArticle, 'slug' | 'thumbnailUrl'>): string {
  return article.thumbnailUrl ?? placeholderImageDataUri(article.slug)
}

export function isDataUri(src: string): boolean {
  return src.startsWith('data:')
}
