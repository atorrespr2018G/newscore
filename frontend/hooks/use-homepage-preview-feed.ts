'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorialPreviewStaleToken } from '@/context/editorial-preview-sync-context'
import {
  getHomepageLayout,
  getHomepagePreviewFeed,
  getLayoutSlots,
  type ISlotOut,
} from '@/lib/api/layout-client'
import type { IHomepageFeed } from '@/interfaces/feed'

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
  const staleToken = useEditorialPreviewStaleToken()
  const [homepageSlots, setHomepageSlots] = useState<ISlotOut[]>([])
  const [previewFeed, setPreviewFeed] = useState<IHomepageFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshRequestIdRef = useRef(0)

  const loadHomepageSlots = useCallback(async () => {
    const layout = await getHomepageLayout()
    if (!layout.id) {
      setHomepageSlots([])
      return
    }
    const slots = await getLayoutSlots(layout.id)
    setHomepageSlots(slots)
  }, [])

  const loadPreviewFeed = useCallback(async () => {
    setError(null)
    try {
      const feed = await getHomepagePreviewFeed()
      setPreviewFeed(feed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load homepage preview')
    }
  }, [])

  const refresh = useCallback(async () => {
    const requestId = refreshRequestIdRef.current + 1
    refreshRequestIdRef.current = requestId
    setRefreshing(true)
    setError(null)
    try {
      await Promise.all([loadHomepageSlots(), loadPreviewFeed()])
    } catch (err) {
      if (refreshRequestIdRef.current === requestId) {
        setError(err instanceof Error ? err.message : 'Failed to refresh preview')
      }
    } finally {
      if (refreshRequestIdRef.current === requestId) {
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [loadHomepageSlots, loadPreviewFeed])

  useEffect(() => {
    if (!pathname.startsWith('/admin/preview')) {
      return
    }
    setLoading(true)
    void refresh()
  }, [pathname, staleToken, refresh])

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
    previewFeed,
    homepageSlots,
    loading,
    refreshing,
    error,
    refresh,
  }
}
