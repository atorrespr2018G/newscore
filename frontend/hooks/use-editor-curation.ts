export { useEditorNews } from '@/hooks/use-editor-news'
export { useEditorPlacementBoard } from '@/hooks/use-editor-placement-board'
export {
  validateArticleEdits,
  loadArticleMedia,
  withLegacyLeadVideo,
  uploadMediaInto,
} from '@/lib/helpers/article-detail-editor'
export type {
  IArticleDetail,
  ILoadedMedia,
  IEditorNews,
  IEditorPlacementBoard,
} from '@/interfaces/editor-article'
