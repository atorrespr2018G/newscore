import type { IArticle, ArticleStatusType } from '@/interfaces/article'

/** Minimal article row shape from the editor articles list API. */
export interface IEditorArticleRow {
  id: string
  title: string
  slug: string
  status: string
  author_name: string
  thumbnail_url: string | null
}

/**
 * Build a minimal article model for homepage thumbnail cards.
 *
 * @param article Row returned by the articles list API.
 * @returns Article fields required by HomepageStoryThumb.
 */
export function editorArticleRowToPreview(article: IEditorArticleRow): IArticle {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: null,
    status: article.status as ArticleStatusType,
    authorName: article.author_name,
    thumbnailUrl: article.thumbnail_url,
    videoUrl: null,
    createdAt: '',
    publishedAt: null,
  }
}
