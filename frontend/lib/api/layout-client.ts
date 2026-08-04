import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import type { IHomepageFeed } from '@/interfaces/feed'
import { mapArticle } from '@/lib/graphql/mappers'
import {
  DEFAULT_EDITOR_MARKET_CODE,
  DEFAULT_EDITOR_PAGE_NAME,
} from '@/lib/editor/editor-scope'
import {
  mapPageAdPlacement,
  type PageAdLocation,
  type PageAdType,
} from '@/lib/helpers/page-ad-placements'
import { toRegionCode } from '@/lib/region-code'

/** API shape for one configured page ad placement. */
export interface IPageAdPlacementApi {
  ad_type: PageAdType
  location: PageAdLocation
  enabled: boolean
  anchor_slug?: string | null
}

/** Layout metadata returned by the layout admin API. */
export interface ILayoutOut {
  id: string
  page_name: string
  market_id: string | null
  region_id: string | null
  scope_mode: 'exact' | 'inherit_from_ancestor'
  inherit_depth_limit: number | null
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
  countyId?: string | null
  regionCode?: string | null
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
  regionCode?: string,
): Promise<ILayoutOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region_code', regionCode)
  }
  return apiFetch<ILayoutOut>(
    `${apiConfig.layout}/layouts/page/${encodeURIComponent(pageName)}?${params.toString()}`,
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
 * Resolve article placements across homepage, world, and sports layouts.
 *
 * @param marketCode Market code such as `us`.
 * @returns Article id to placement list lookup.
 */
export function getArticlePlacements(
  marketCode = DEFAULT_EDITOR_MARKET_CODE,
  regionCode?: string,
  townId?: string | null,
): Promise<IArticlePlacementsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (townId) {
    params.set('town', townId)
  }
  if (regionCode) {
    params.set('region_code', regionCode)
  }
  return apiFetch<IArticlePlacementsOut>(`${apiConfig.layout}/layouts/placements?${params.toString()}`)
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
  region_code?: string | null
  slots: IPreviewFeedSlotOut[]
  ad_placements?: Array<{
    ad_type: string
    location: string
    enabled: boolean
    anchor_slug?: string | null
  }>
}

/**
 * Map REST preview feed payload to IHomepageFeed.
 *
 * @param payload Preview feed from layout admin API.
 * @returns Homepage feed for HomepageContent.
 */
export function mapPreviewFeedToHomepageFeed(payload: IPreviewFeedOut): IHomepageFeed {
  const adPlacements = (payload.ad_placements ?? [])
    .map((row) => mapPageAdPlacement(row))
    .filter((row): row is NonNullable<typeof row> => row !== null)
  return {
    layoutId: payload.layout_id ?? '',
    pageName: payload.page_name,
    adPlacements,
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
  const resolvedRegionCode =
    params.regionCode ?? toRegionCode(marketCode, params.townId ?? null, params.countyId ?? null)
  const queryParams = new URLSearchParams({
    market: marketCode,
    page_name: pageName,
  })
  if (params.townId) {
    queryParams.set('town', params.townId)
  }
  queryParams.set('region_code', resolvedRegionCode)
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
  const resolvedRegionCode =
    scope.regionCode ?? toRegionCode(marketCode, scope.townId ?? null, scope.countyId ?? null)
  const params = new URLSearchParams({
    market: marketCode,
    page_name: pageName,
    region_code: resolvedRegionCode,
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

/** Sports page section template used for layout and Placement slots. */
export type SportsPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'world'
  | 'sport'
  | 'ribbon_ad'

/** One ordered section on a sports page. */
export interface ISportsPageSectionItem {
  section_type: SportsPageSectionType
  slug: string
  label: string
}

/** Sports page section list for a market or state region. */
export interface ISportsPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: ISportsPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered sports section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Sports section list payload.
 */
export function getSportsPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<ISportsPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<ISportsPageSectionsOut>(
    `${apiConfig.layout}/sports-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered sports section list and sync layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Updated sports section list payload.
 */
export function putSportsPageSections(
  marketCode: string,
  items: Array<{ section_type: SportsPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<ISportsPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<ISportsPageSectionsOut>(
    `${apiConfig.layout}/sports-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

/** Main landing page section template used for layout and Placement slots. */
export type MainPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'more_top_stories'
  | 'spotlight'
  | 'rail'
  | 'category'
  | 'ribbon_ad'

/** One ordered section on the main landing page. */
export interface IMainPageSectionItem {
  section_type: MainPageSectionType
  slug: string
  label: string
}

/** Main-page section list for a market or geo region. */
export interface IMainPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: IMainPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered main-page section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-geo lists.
 * @returns Main-page section list payload.
 */
export function getMainPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<IMainPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IMainPageSectionsOut>(
    `${apiConfig.layout}/main-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered main-page section list and sync homepage layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-geo lists.
 * @returns Updated main-page section list payload.
 */
export function putMainPageSections(
  marketCode: string,
  items: Array<{ section_type: MainPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<IMainPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IMainPageSectionsOut>(
    `${apiConfig.layout}/main-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

/** World page section template used for layout and Placement slots. */
export type WorldPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'more_top_stories'
  | 'spotlight'
  | 'rail'
  | 'category'
  | 'ribbon_ad'

/** One ordered section on the World page. */
export interface IWorldPageSectionItem {
  section_type: WorldPageSectionType
  slug: string
  label: string
}

/** World-page section list for a market or geo region. */
export interface IWorldPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: IWorldPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered World-page section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-geo lists.
 * @returns World-page section list payload.
 */
export function getWorldPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<IWorldPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IWorldPageSectionsOut>(
    `${apiConfig.layout}/world-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered World-page section list and sync World layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-geo lists.
 * @returns Updated World-page section list payload.
 */
export function putWorldPageSections(
  marketCode: string,
  items: Array<{ section_type: WorldPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<IWorldPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IWorldPageSectionsOut>(
    `${apiConfig.layout}/world-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}
