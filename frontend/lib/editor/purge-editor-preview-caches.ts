import type { QueryClient } from '@tanstack/react-query'
import { editorKeys } from '@/lib/editor/query-keys'

/**
 * Drop every cached editor preview feed and slot board.
 *
 * Worldwide place/unplace mutates many markets at once. Leaving other scopes in
 * the React Query cache causes a one-frame flash of the removed story when the
 * editor switches market, county, or town.
 *
 * @param queryClient Active TanStack Query client.
 */
export function purgeEditorPreviewCaches(queryClient: QueryClient): void {
  void queryClient.removeQueries({ queryKey: [...editorKeys.all, 'previewFeed'] })
  void queryClient.removeQueries({ queryKey: [...editorKeys.all, 'slots'] })
  void queryClient.removeQueries({ queryKey: [...editorKeys.all, 'placements'] })
}
