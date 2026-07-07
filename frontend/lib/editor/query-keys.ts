import { editorScopeRegionCode, type IEditorScope } from '@/lib/editor/editor-scope'

/** Query-key helpers for scoped editor data. */
export const editorKeys = {
  all: ['editor'] as const,
  layout: (scope: IEditorScope) =>
    [...editorKeys.all, 'layout', scope.marketCode, scope.pageName, editorScopeRegionCode(scope)] as const,
  slots: (scope: IEditorScope) =>
    [...editorKeys.all, 'slots', scope.marketCode, scope.townId, scope.countyId, scope.pageName, editorScopeRegionCode(scope)] as const,
  previewFeed: (scope: IEditorScope) =>
    [...editorKeys.all, 'previewFeed', scope.marketCode, scope.townId, scope.countyId, scope.pageName, editorScopeRegionCode(scope)] as const,
  placements: (scope: IEditorScope) =>
    [...editorKeys.all, 'placements', scope.marketCode, scope.pageName, editorScopeRegionCode(scope)] as const,
}
