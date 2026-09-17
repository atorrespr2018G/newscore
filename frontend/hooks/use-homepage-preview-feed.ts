'use client'

import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useEditorScope } from '@/context/editor-scope-context'
import {
  useEditorialPreviewStaleScope,
  useEditorialPreviewStaleToken,
} from '@/context/editorial-preview-sync-context'
import { useEditorPreviewFeed } from '@/hooks/use-editor-preview-feed'
import type { IHomepageFeed } from '@/interfaces/feed'
import type { ISlotOut } from '@/lib/api/layout-client'
import { purgeEditorPreviewCaches } from '@/lib/editor/purge-editor-preview-caches'
import { editorKeys } from '@/lib/editor/query-keys'

interface IUseHomepagePreviewFeedResult {
  previewFeed: IHomepageFeed | null
  homepageSlots: ISlotOut[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Load and keep homepage preview feed fresh for the standalone preview page.
 *
 * Refetches when the route is visited, editor changes are signaled, or the tab
 * regains focus.
 *
 * @returns Preview feed state and refresh handler.
 */
export function useHomepagePreviewFeed(): IUseHomepagePreviewFeedResult {
  const pathname = usePathname()
  const scope = useEditorScope()
  const staleScope = useEditorialPreviewStaleScope()
  const staleToken = useEditorialPreviewStaleToken()
  const queryClient = useQueryClient()
  const preview = useEditorPreviewFeed(scope, pathname.startsWith('/admin/preview'))

  const refresh = useCallback(async () => {
    await preview.refresh()
  }, [preview])

  useEffect(() => {
    if (!pathname.startsWith('/admin/preview') || staleToken === 0) {
      return
    }
    if (staleScope == null) {
      purgeEditorPreviewCaches(queryClient)
    } else {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: editorKeys.previewFeed(staleScope) }),
        queryClient.invalidateQueries({ queryKey: editorKeys.slots(staleScope) }),
      ])
    }
  }, [pathname, queryClient, staleScope, staleToken])

  useEffect(() => {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible' && pathname.startsWith('/admin/preview')) {
        void refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [pathname, refresh])

  return {
    previewFeed: preview.previewFeed,
    homepageSlots: preview.homepageSlots,
    loading: preview.loading,
    refreshing: preview.refreshing,
    error: preview.error,
    refresh,
  }
}
