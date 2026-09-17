import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import {
  placeArticleWorldwide,
  unplaceArticleEverywhere,
  type ISlotOut,
  type IUnplaceArticleOut,
  type IWorldwidePlacementOut,
} from '@/lib/api/layout-client'
import type { IArticleDetail } from '@/interfaces/editor-article'
import type { IPlacementMutationResult } from '@/lib/helpers/editor-placement'

/**
 * Load whether an article is marked worldwide for placement fan-out.
 *
 * @param articleId Article id.
 * @returns True when the story should fan out across markets.
 */
export async function fetchArticleIsWorldwide(articleId: string): Promise<boolean> {
  const detail = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
  return Boolean(detail.worldwide)
}

/**
 * Fan a placement mutation out to every non-excluded market.
 *
 * Calls place-worldwide once per updated slot so category cascades follow the
 * same positions as the local Placement drop.
 *
 * @param options Article id, page, slots, and local mutation to fan out.
 * @returns Combined fan-out results, or null when the story is not worldwide.
 */
export async function fanOutWorldwidePlacementMutation(options: {
  articleId: string
  pageName: string
  slots: ISlotOut[]
  mutation: IPlacementMutationResult
}): Promise<IWorldwidePlacementOut[] | null> {
  const { articleId, pageName, slots, mutation } = options
  const isWorldwide = await fetchArticleIsWorldwide(articleId)
  if (!isWorldwide) {
    return null
  }

  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const results: IWorldwidePlacementOut[] = []

  for (const update of mutation.updates) {
    const slot = slotById.get(update.slotId)
    if (!slot || slot.content_type !== 'articles') {
      continue
    }
    const position = update.draftPinnedIds.indexOf(articleId)
    if (position < 0) {
      continue
    }
    results.push(
      await placeArticleWorldwide({
        article_id: articleId,
        page_name: pageName,
        position_key: slot.position_key,
        position,
        publish: true,
      }),
    )
  }

  return results
}

/**
 * Remove a story from every layout board where it is pinned.
 *
 * @param articleId Story being removed.
 * @returns Unplace summary.
 */
export async function unplaceArticleFromAllBoards(
  articleId: string,
): Promise<IUnplaceArticleOut> {
  return unplaceArticleEverywhere({ article_id: articleId })
}

/**
 * Summarize how many region boards received at least one fan-out pin.
 *
 * @param results Fan-out responses from place-worldwide.
 * @returns Placed and skipped board counts (unique market+region).
 */
export function summarizeWorldwideFanOut(
  results: IWorldwidePlacementOut[],
): { placed: number; skipped: number } {
  const placed = new Set<string>()
  const skipped = new Set<string>()
  for (const result of results) {
    for (const row of result.results) {
      const key = `${row.market_code}:${row.region_code || row.region_id || ''}`
      if (row.status === 'placed') {
        placed.add(key)
      } else {
        skipped.add(key)
      }
    }
  }
  for (const key of placed) {
    skipped.delete(key)
  }
  return { placed: placed.size, skipped: skipped.size }
}
