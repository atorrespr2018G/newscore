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

/** Government page section template used for layout and Placement slots. */
export type GovernmentPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'world'
  | 'topic'
  | 'ribbon_ad'

/** One ordered section on a government page. */
export interface IGovernmentPageSectionItem {
  section_type: GovernmentPageSectionType
  slug: string
  label: string
}

/** Government page section list for a market or state region. */
export interface IGovernmentPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: IGovernmentPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered government section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Government section list payload.
 */
export function getGovernmentPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<IGovernmentPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IGovernmentPageSectionsOut>(
    `${apiConfig.layout}/government-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered government section list and sync layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Updated government section list payload.
 */
export function putGovernmentPageSections(
  marketCode: string,
  items: Array<{ section_type: GovernmentPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<IGovernmentPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IGovernmentPageSectionsOut>(
    `${apiConfig.layout}/government-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

/** Entertainment page section template used for layout and Placement slots. */
export type EntertainmentPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'entertainment'
  | 'ribbon_ad'

/** One ordered section on an entertainment page. */
export interface IEntertainmentPageSectionItem {
  section_type: EntertainmentPageSectionType
  slug: string
  label: string
}

/** Entertainment page section list for a market or state region. */
export interface IEntertainmentPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: IEntertainmentPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered entertainment section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Entertainment section list payload.
 */
export function getEntertainmentPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<IEntertainmentPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IEntertainmentPageSectionsOut>(
    `${apiConfig.layout}/entertainment-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered entertainment section list and sync layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Updated entertainment section list payload.
 */
export function putEntertainmentPageSections(
  marketCode: string,
  items: Array<{ section_type: EntertainmentPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<IEntertainmentPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IEntertainmentPageSectionsOut>(
    `${apiConfig.layout}/entertainment-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

/** Business page section template used for layout and Placement slots. */
export type BusinessPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'business'
  | 'ribbon_ad'

/** One ordered section on a business page. */
export interface IBusinessPageSectionItem {
  section_type: BusinessPageSectionType
  slug: string
  label: string
}

/** Business page section list for a market or state region. */
export interface IBusinessPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: IBusinessPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered business section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Business section list payload.
 */
export function getBusinessPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<IBusinessPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IBusinessPageSectionsOut>(
    `${apiConfig.layout}/business-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered business section list and sync layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @param ads Optional ad placement rows.
 * @returns Updated business section list payload.
 */
export function putBusinessPageSections(
  marketCode: string,
  items: Array<{ section_type: BusinessPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<IBusinessPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IBusinessPageSectionsOut>(
    `${apiConfig.layout}/business-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

/** Health page section template used for layout and Placement slots. */
export type HealthPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'health'
  | 'ribbon_ad'

/** One ordered section on a health page. */
export interface IHealthPageSectionItem {
  section_type: HealthPageSectionType
  slug: string
  label: string
}

/** Health page section list for a market or state region. */
export interface IHealthPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: IHealthPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered health section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Health section list payload.
 */
export function getHealthPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<IHealthPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IHealthPageSectionsOut>(
    `${apiConfig.layout}/health-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered health section list and sync layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Updated health section list payload.
 */
export function putHealthPageSections(
  marketCode: string,
  items: Array<{ section_type: HealthPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<IHealthPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IHealthPageSectionsOut>(
    `${apiConfig.layout}/health-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

/** Technology page section template used for layout and Placement slots. */
export type TechnologyPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'archive'
  | 'ribbon_ad'

/** One ordered section on a technology page. */
export interface ITechnologyPageSectionItem {
  section_type: TechnologyPageSectionType
  slug: string
  label: string
}

/** Technology page section list for a market or state region. */
export interface ITechnologyPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: ITechnologyPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered technology section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @returns Technology section list payload.
 */
export function getTechnologyPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<ITechnologyPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<ITechnologyPageSectionsOut>(
    `${apiConfig.layout}/technology-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered technology section list and sync layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections (label required; slug optional).
 * @param regionCode Optional region code such as `us-fl` for per-state lists.
 * @param ads Optional ad placement rows.
 * @returns Updated technology section list payload.
 */
export function putTechnologyPageSections(
  marketCode: string,
  items: Array<{ section_type: TechnologyPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<ITechnologyPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<ITechnologyPageSectionsOut>(
    `${apiConfig.layout}/technology-page-sections?${params.toString()}`,
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

/** Politics page section template used for layout and Placement slots. */
export type PoliticsPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'more_top_stories'
  | 'spotlight'
  | 'rail'
  | 'category'
  | 'ribbon_ad'

/** One ordered section on the Politics page. */
export interface IPoliticsPageSectionItem {
  section_type: PoliticsPageSectionType
  slug: string
  label: string
}

/** Politics-page section list for a market or geo region. */
export interface IPoliticsPageSectionsOut {
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: IPoliticsPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * Load the ordered Politics-page section list for a market or region.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl` for per-geo lists.
 * @returns Politics-page section list payload.
 */
export function getPoliticsPageSections(
  marketCode: string,
  regionCode?: string | null,
): Promise<IPoliticsPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IPoliticsPageSectionsOut>(
    `${apiConfig.layout}/politics-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered Politics-page section list and sync layout slots.
 *
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered section rows to persist.
 * @param regionCode Optional region code such as `us-fl`.
 * @param ads Optional page-level ad placements.
 * @returns Updated Politics-page section list payload.
 */
export function putPoliticsPageSections(
  marketCode: string,
  items: Array<{ section_type: PoliticsPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<IPoliticsPageSectionsOut> {
  const params = new URLSearchParams({ market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<IPoliticsPageSectionsOut>(
    `${apiConfig.layout}/politics-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

/** One registered custom tab for More and Configuration. */
export interface ICustomTab {
  slug: string
  label: string
  market_code: string
  sort_order: number
  created_at: string
  updated_at: string
}

/** Custom tab page section template. */
export type CustomPageSectionType =
  | 'hero'
  | 'top_stories'
  | 'live'
  | 'topic'
  | 'ribbon_ad'

/** One ordered section on a custom tab page. */
export interface ICustomPageSectionItem {
  section_type: CustomPageSectionType
  slug: string
  label: string
}

/** Custom tab section list for a market or region. */
export interface ICustomPageSectionsOut {
  page_name: string
  market_id: string
  market_code: string
  region_id: string | null
  region_code: string | null
  items: ICustomPageSectionItem[]
  ads: IPageAdPlacementApi[]
  updated_at: string
}

/**
 * List custom tabs without requiring an editorial session (public More menu).
 *
 * @param marketCode Optional market filter such as `us` or `pr`.
 * @returns Ordered custom tabs for that market (or all when omitted).
 */
export async function listCustomTabs(marketCode?: string | null): Promise<ICustomTab[]> {
  const params = new URLSearchParams()
  if (marketCode?.trim()) {
    params.set('market', marketCode.trim().toLowerCase())
  }
  const query = params.toString()
  const url = query
    ? `${apiConfig.layout}/custom-tabs?${query}`
    : `${apiConfig.layout}/custom-tabs`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load custom tabs (${res.status})`)
  }
  const body = (await res.json()) as { items: ICustomTab[] }
  return body.items ?? []
}

/**
 * Create a custom tab for one market and seed its geo section boards.
 *
 * @param label Display name.
 * @param marketCode Owning market short code such as `us` or `pr`.
 * @param slug Optional URL slug; derived from label when omitted.
 * @returns Created custom tab.
 */
export function createCustomTab(
  label: string,
  marketCode: string,
  slug?: string,
): Promise<ICustomTab> {
  return apiFetch<ICustomTab>(`${apiConfig.layout}/custom-tabs`, {
    method: 'POST',
    body: JSON.stringify({
      label,
      market_code: marketCode,
      slug: slug || undefined,
    }),
  })
}

/**
 * Delete a custom tab and its section documents.
 *
 * @param slug Tab slug to remove.
 */
export async function deleteCustomTab(slug: string): Promise<void> {
  await apiFetch<void>(`${apiConfig.layout}/custom-tabs/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
}

/**
 * Load the ordered custom section list for a tab and geo scope.
 *
 * @param pageName Custom tab slug.
 * @param marketCode Market code such as `pr` or `us`.
 * @param regionCode Optional region code such as `us-fl`.
 * @returns Custom section list payload.
 */
export function getCustomPageSections(
  pageName: string,
  marketCode: string,
  regionCode?: string | null,
): Promise<ICustomPageSectionsOut> {
  const params = new URLSearchParams({ page: pageName, market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<ICustomPageSectionsOut>(
    `${apiConfig.layout}/custom-page-sections?${params.toString()}`,
  )
}

/**
 * Replace the ordered custom section list and sync layout slots.
 *
 * @param pageName Custom tab slug.
 * @param marketCode Market code such as `pr` or `us`.
 * @param items Ordered typed sections.
 * @param regionCode Optional region code.
 * @param ads Optional ad placement rows.
 * @returns Updated custom section list payload.
 */
export function putCustomPageSections(
  pageName: string,
  marketCode: string,
  items: Array<{ section_type: CustomPageSectionType; label: string; slug?: string }>,
  regionCode?: string | null,
  ads?: IPageAdPlacementApi[],
): Promise<ICustomPageSectionsOut> {
  const params = new URLSearchParams({ page: pageName, market: marketCode })
  if (regionCode) {
    params.set('region', regionCode)
  }
  return apiFetch<ICustomPageSectionsOut>(
    `${apiConfig.layout}/custom-page-sections?${params.toString()}`,
    {
      method: 'PUT',
      body: JSON.stringify({ items, ads }),
    },
  )
}

