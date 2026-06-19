import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import type { IHomepageFeed } from '@/interfaces/feed'
import { mapArticle } from '@/lib/graphql/mappers'
import {
  DEFAULT_EDITOR_MARKET_CODE,
  DEFAULT_EDITOR_PAGE_NAME,
} from '@/lib/editor/editor-scope'

/** Layout metadata returned by the layout admin API. */
export interface ILayoutOut {
  id: string
  page_name: string
  market_id: string | null
  slot_ids: string[]
  is_active: boolean
  updated_at: string
}

/** Resolved article placement within a layout slot. */
export interface IArticlePlacementOut {
  page_name: string
  position_key: string
  display_name: string
  position: number
}

/** Article id to placement list lookup. */
export interface IArticlePlacementsOut {
  placements: Record<string, IArticlePlacementOut[]>
}

/** Homepage slot metadata used for landing curation. */
export interface ISlotOut {
  id: string
  layout_id: string
  position_key: string
  content_type: string
  display_name: string | null
  presentation_type: string
  pinned_ids: string[]
  draft_pinned_ids: string[] | null
  query_rule: Record<string, unknown> | null
  order_index: number
  updated_at: string
}

/** Response from publishing staged homepage placements. */
export interface IPublishPlacementsOut {
  layout_id: string
  page_name: string
  market_code: string
  published_slot_count: number
}

const HERO_POSITION_KEY = 'hero'

interface ILayoutScopeParams {
  marketCode?: string
  townId?: string | null
  pageName?: string
}

/**
 * Load the active homepage layout for a market.
 *
 * @param marketCode Market code such as `us`.
 * @returns Active homepage layout metadata.
 */
export function getHomepageLayout(
  marketCode = DEFAULT_EDITOR_MARKET_CODE,
  pageName = DEFAULT_EDITOR_PAGE_NAME,
): Promise<ILayoutOut> {
  return apiFetch<ILayoutOut>(
    `${apiConfig.layout}/layouts/page/${encodeURIComponent(pageName)}?market=${encodeURIComponent(marketCode)}`,
  )
}

/**
 * List slots attached to a layout.
 *
 * @param layoutId Layout id to query.
 * @returns Slot payloads in display order.
 */
export function getLayoutSlots(layoutId: string): Promise<ISlotOut[]> {
  return apiFetch<ISlotOut[]>(`${apiConfig.layout}/layouts/${layoutId}/slots`)
}

/**
 * Resolve article placements across homepage and world layouts.
 *
 * @param marketCode Market code such as `us`.
 * @returns Article id to placement list lookup.
 */
export function getArticlePlacements(
  marketCode = DEFAULT_EDITOR_MARKET_CODE,
): Promise<IArticlePlacementsOut> {
  return apiFetch<IArticlePlacementsOut>(
    `${apiConfig.layout}/layouts/placements?market=${encodeURIComponent(marketCode)}`,
  )
}

/**
 * Resolve the hero slot used for landing card ordering.
 *
 * @param slots Slot list for a homepage layout.
 * @returns Hero slot or null when missing.
 */
export function findHeroSlot(slots: ISlotOut[]): ISlotOut | null {
  return slots.find((slot) => slot.position_key === HERO_POSITION_KEY) ?? null
}

/** REST preview feed slot payload from layout admin API. */
interface IPreviewFeedSlotOut {
  id: string
  position_key: string
  display_name: string | null
  presentation_type: string
  content_type: string
  articles: Array<{
    id: string
    title: string
    slug: string
    status: string
    author_name: string
    thumbnail_url: string | null
    video_url: string | null
    created_at: string
    published_at: string | null
  }>
}

/** REST preview feed payload from layout admin API. */
interface IPreviewFeedOut {
  layout_id: string | null
  page_name: string
  market_code: string
  slots: IPreviewFeedSlotOut[]
}

/**
 * Map REST preview feed payload to IHomepageFeed.
 *
 * @param payload Preview feed from layout admin API.
 * @returns Homepage feed for HomepageContent.
 */
export function mapPreviewFeedToHomepageFeed(payload: IPreviewFeedOut): IHomepageFeed {
  return {
    layoutId: payload.layout_id ?? '',
    pageName: payload.page_name,
    slots: payload.slots.map((slot) => ({
      id: slot.id,
      positionKey: slot.position_key,
      displayName: slot.display_name,
      presentationType: slot.presentation_type,
      contentType: slot.content_type,
      articles: slot.articles.map((article) =>
        mapArticle({
          id: article.id,
          title: article.title,
          slug: article.slug,
          status: article.status,
          authorName: article.author_name,
          thumbnailUrl: article.thumbnail_url,
          videoUrl: article.video_url,
          createdAt: article.created_at,
          publishedAt: article.published_at,
        }),
      ),
    })),
  }
}

/**
 * Load homepage preview feed with draft pins resolved.
 *
 * @param marketCode Market code such as `us`.
 * @returns Homepage feed for editor preview pane.
 */
export function getHomepagePreviewFeed(params: ILayoutScopeParams = {}): Promise<IHomepageFeed> {
  const marketCode = params.marketCode ?? DEFAULT_EDITOR_MARKET_CODE
  const pageName = params.pageName ?? DEFAULT_EDITOR_PAGE_NAME
  const queryParams = new URLSearchParams({
    market: marketCode,
    page_name: pageName,
  })
  if (params.townId) {
    queryParams.set('town', params.townId)
  }
  return apiFetch<IPreviewFeedOut>(`${apiConfig.layout}/layouts/preview-feed?${queryParams.toString()}`, {
    cache: 'no-store',
  }).then(
    mapPreviewFeedToHomepageFeed,
  )
}

/**
 * Patch staged pinned article ids for a slot.
 *
 * @param slotId Slot id to update.
 * @param draftPinnedIds Ordered draft pinned article ids.
 * @returns Updated slot payload.
 */
export function patchSlotDraftPinnedIds(slotId: string, draftPinnedIds: string[]): Promise<ISlotOut> {
  return apiFetch<ISlotOut>(`${apiConfig.layout}/slots/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify({ draft_pinned_ids: draftPinnedIds }),
  })
}

/**
 * Promote staged homepage placements to the live layout.
 *
 * @param marketCode Market code such as `us`.
 * @returns Publish summary for the active homepage layout.
 */
export function publishHomepagePlacements(scope: ILayoutScopeParams = {}): Promise<IPublishPlacementsOut> {
  const marketCode = scope.marketCode ?? DEFAULT_EDITOR_MARKET_CODE
  const pageName = scope.pageName ?? DEFAULT_EDITOR_PAGE_NAME
  const params = new URLSearchParams({
    market: marketCode,
    page_name: pageName,
  })
  if (scope.townId) {
    params.set('town', scope.townId)
  }
  return apiFetch<IPublishPlacementsOut>(
    `${apiConfig.layout}/layouts/publish-placements?${params.toString()}`,
    { method: 'POST' },
  )
}

/**
 * Patch pinned article ids for a slot.
 *
 * @param slotId Slot id to update.
 * @param pinnedIds Ordered pinned article ids.
 * @returns Updated slot payload.
 * @deprecated Use patchSlotDraftPinnedIds for editor placement changes.
 */
export function patchSlotPinnedIds(slotId: string, pinnedIds: string[]): Promise<ISlotOut> {
  return apiFetch<ISlotOut>(`${apiConfig.layout}/slots/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned_ids: pinnedIds }),
  })
}
