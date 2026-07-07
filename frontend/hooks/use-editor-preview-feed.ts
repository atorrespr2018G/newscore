'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { IHomepageFeed } from '@/interfaces/feed'
import {
  getHomepageLayout,
  getHomepagePreviewFeed,
  getLayoutSlots,
  type ISlotOut,
} from '@/lib/api/layout-client'
import { editorScopeRegionCode, type IEditorScope } from '@/lib/editor/editor-scope'
import { editorKeys } from '@/lib/editor/query-keys'

interface IUseEditorPreviewFeedResult {
  previewFeed: IHomepageFeed | null
  homepageSlots: ISlotOut[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Read scoped homepage preview feed and slots using TanStack Query.
 *
 * @param scope Active editor scope.
 * @param enabled Enables fetching for mounted preview routes only.
 * @returns Preview feed state and refresh handler.
 */
export function useEditorPreviewFeed(
  scope: IEditorScope,
  enabled: boolean,
): IUseEditorPreviewFeedResult {
  const queryClient = useQueryClient()
  const previewQuery = useQuery({
    queryKey: editorKeys.previewFeed(scope),
    queryFn: () =>
      getHomepagePreviewFeed({
        marketCode: scope.marketCode,
        townId: scope.townId,
        countyId: scope.countyId,
        regionCode: editorScopeRegionCode(scope),
        pageName: scope.pageName,
      }),
    enabled,
  })
  const slotsQuery = useQuery({
    queryKey: editorKeys.slots(scope),
    queryFn: async () => {
      const layout = await getHomepageLayout(
        scope.marketCode,
        scope.pageName,
        editorScopeRegionCode(scope),
      )
      if (!layout.id) {
        return []
      }
      return getLayoutSlots(layout.id)
    },
    enabled,
  })

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: editorKeys.previewFeed(scope) }),
      queryClient.invalidateQueries({ queryKey: editorKeys.slots(scope) }),
    ])
    await Promise.all([previewQuery.refetch(), slotsQuery.refetch()])
  }, [previewQuery, queryClient, scope, slotsQuery])

  return {
    previewFeed: previewQuery.data ?? null,
    homepageSlots: slotsQuery.data ?? [],
    loading: previewQuery.isLoading || slotsQuery.isLoading,
    refreshing: previewQuery.isFetching || slotsQuery.isFetching,
    error:
      previewQuery.error instanceof Error
        ? previewQuery.error.message
        : slotsQuery.error instanceof Error
          ? slotsQuery.error.message
          : null,
    refresh,
  }
}
