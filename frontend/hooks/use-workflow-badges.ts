'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMarket } from '@/context/market-context'
import {
  WORKFLOW_BADGES_REFRESH_EVENT,
  getPlacementNewCount,
  getReviewNewCount,
  markWorkflowViewSeen,
  notifyWorkflowBadgesRefresh,
  type WorkflowViewType,
} from '@/lib/api/workflow-badges-client'

/** Poll cadence for workflow badge counts while an admin page is open. */
const WORKFLOW_BADGE_POLL_MS = 30000

/** Admin route prefix; badge counts are only fetched within the admin app. */
const ADMIN_PATH_PREFIX = '/admin'

/** New-item counts for the Placement and Review workflow tabs. */
export interface IWorkflowBadgeCounts {
  placement: number
  review: number
}

const ZERO_COUNTS: IWorkflowBadgeCounts = { placement: 0, review: 0 }

/**
 * Track "new since last seen" counts for the Placement and Review tabs.
 *
 * Counts refresh on mount, every {@link WORKFLOW_BADGE_POLL_MS} ms, on window
 * focus, and whenever a mark-seen action dispatches the refresh event. Fetching
 * is disabled outside the admin app so the shared masthead stays inert publicly.
 *
 * @returns The current placement and review badge counts.
 */
export function useWorkflowBadges(): IWorkflowBadgeCounts {
  const pathname = usePathname()
  const { marketCode } = useMarket()
  const [counts, setCounts] = useState<IWorkflowBadgeCounts>(ZERO_COUNTS)
  const enabled = pathname?.startsWith(ADMIN_PATH_PREFIX) ?? false
  const marketRef = useRef(marketCode)
  marketRef.current = marketCode

  const refresh = useCallback(async () => {
    try {
      const [placement, review] = await Promise.all([
        getPlacementNewCount(marketRef.current),
        getReviewNewCount(),
      ])
      setCounts({ placement, review })
    } catch {
      // Badge counts are best-effort; ignore transient fetch failures so the
      // masthead never surfaces an error for a non-critical indicator.
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setCounts(ZERO_COUNTS)
      return
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), WORKFLOW_BADGE_POLL_MS)
    const handleRefresh = (): void => void refresh()
    window.addEventListener('focus', handleRefresh)
    window.addEventListener(WORKFLOW_BADGES_REFRESH_EVENT, handleRefresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener(WORKFLOW_BADGES_REFRESH_EVENT, handleRefresh)
    }
  }, [enabled, marketCode, refresh])

  return counts
}

/**
 * Mark a workflow view as seen on mount, clearing its badge for this user.
 *
 * Call from the Placement and Review pages so opening the tab zeroes the count
 * both on the backend (last-seen) and immediately in the masthead badge.
 *
 * @param view Workflow view the mounted page represents.
 */
export function useMarkWorkflowViewSeen(view: WorkflowViewType): void {
  useEffect(() => {
    void markWorkflowViewSeen(view)
      .then(notifyWorkflowBadgesRefresh)
      .catch(() => {
        // Best-effort; a failed mark-seen simply leaves the badge until the
        // next successful poll.
      })
  }, [view])
}
