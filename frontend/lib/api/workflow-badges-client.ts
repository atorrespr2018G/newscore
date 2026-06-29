import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'

/** Workflow views that carry a "new since last seen" badge. */
export type WorkflowViewType = 'placement' | 'review'

/** Count payload returned by the workflow new-count endpoints. */
interface IWorkflowCountOut {
  count: number
}

/** Custom DOM event name used to nudge badge hooks to refetch immediately. */
export const WORKFLOW_BADGES_REFRESH_EVENT = 'workflow-badges-refresh'

/**
 * Fetch the number of stories newly placed since the user last opened Placement.
 *
 * @param marketCode Market short code to scope the count to.
 * @returns The new-placement count (0 on a successful empty result).
 * @throws ApiError When the request fails.
 */
export async function getPlacementNewCount(marketCode: string): Promise<number> {
  const params = new URLSearchParams({ market: marketCode })
  const data = await apiFetch<IWorkflowCountOut>(
    `${apiConfig.layout}/placements/new-count?${params.toString()}`,
  )
  return data.count
}

/**
 * Fetch the number of stories newly entering review since the user's last visit.
 *
 * @returns The new-in-review count.
 * @throws ApiError When the request fails.
 */
export async function getReviewNewCount(): Promise<number> {
  const data = await apiFetch<IWorkflowCountOut>(
    `${apiConfig.news}/articles/review/new-count`,
  )
  return data.count
}

/**
 * Mark a workflow view as seen now for the current user, clearing its badge.
 *
 * @param view Workflow view being opened.
 * @param marketCode Market short code (only used by the placement view).
 * @throws ApiError When the request fails.
 */
export async function markWorkflowViewSeen(
  view: WorkflowViewType,
  marketCode?: string,
): Promise<void> {
  const base = view === 'placement' ? apiConfig.layout : apiConfig.news
  await apiFetch(`${base}/view-state/${view}`, { method: 'PUT' })
  // marketCode is accepted for symmetry with the count call; last-seen is
  // tracked per user/view and is market-agnostic on the backend.
  void marketCode
}

/**
 * Notify any mounted badge hooks that the counts should be refetched now.
 *
 * Called after marking a view as seen so the badge clears without waiting for
 * the next poll interval.
 */
export function notifyWorkflowBadgesRefresh(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new Event(WORKFLOW_BADGES_REFRESH_EVENT))
}
