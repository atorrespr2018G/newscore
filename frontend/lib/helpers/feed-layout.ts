import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import {
  PRESENTATION_EDITORIAL_LEAD,
  PRESENTATION_EDITORIAL_SPOTLIGHT,
  PRESENTATION_RAIL_COMPACT,
} from '@/lib/presentation-registry'

/** Maximum pinned stories in the homepage hero slot. */
export const HERO_PINNED_LIMIT = 12

/** Maximum pinned stories in the Top Stories (`us-featured`) band. */
export const US_FEATURED_PINNED_LIMIT = 12

/** Maximum pinned stories in a More Top Stories editorial-lead column. */
export const MORE_TOP_STORIES_PINNED_LIMIT = 7

/** Picture lead stories at the top of an editorial-lead column. */
export const EDITORIAL_LEAD_IMAGE_COUNT = 1

/** Side-thumbnail compact stories below the editorial lead. */
export const EDITORIAL_COMPACT_IMAGE_COUNT = 3

/** More Top Stories slot position keys sharing the editorial-lead column layout. */
export const MORE_TOP_STORIES_POSITION_KEYS = ['more-top-stories', 'more-top-stories-2'] as const

/** Homepage slots that insert new stories and evict the trailing item when full. */
export const SHIFT_DOWN_PLACEMENT_POSITION_KEYS = [
  'hero',
  'us-featured',
  ...MORE_TOP_STORIES_POSITION_KEYS,
] as const

/** Hero pinned-article index map (12 articles, indices 0–11): 0 = center lead. */
const DEFAULT_HERO_LEFT_INDICES = [1, 2, 3] as const
const DEFAULT_HERO_RIGHT_INDICES = [10, 11] as const
const DEFAULT_HERO_RELATED_START_INDEX = 4
const DEFAULT_HERO_RELATED_END_INDEX = 7
const DEFAULT_HERO_STRIP_START_INDEX = 7
const DEFAULT_HERO_STRIP_END_INDEX = 10

export interface IEditorialBandSlots {
  lead: IFeedSlot
  spotlight: IFeedSlot
  rail?: IFeedSlot
}

export interface IDefaultHeroSlices {
  left: IArticle[]
  relatedLinks: IArticle[]
  strip: IArticle[]
  rightCards: IArticle[]
}

/** Top Stories band index map (12 articles, indices 0–11): 0 = center hero. */
const US_FEATURED_CENTER_INDEX = 0
const US_FEATURED_CENTER_TOP_START_INDEX = 1
const US_FEATURED_CENTER_TOP_COUNT = 2
const US_FEATURED_LEFT_START_INDEX = 3
const US_FEATURED_LEFT_COUNT = 2
const US_FEATURED_LEFT_LINKS_START_INDEX = 5
const US_FEATURED_LEFT_LINKS_COUNT = 3
const US_FEATURED_RIGHT_START_INDEX = 8
const US_FEATURED_RIGHT_COUNT = 1
const US_FEATURED_RIGHT_LINKS_START_INDEX = 9
const US_FEATURED_RIGHT_LINKS_COUNT = 3

export interface IUsFeaturedBandSlices {
  center: IArticle | undefined
  centerTop: IArticle[]
  left: IArticle[]
  leftLinks: IArticle[]
  right: IArticle[]
  rightLinks: IArticle[]
}

/** Editorial-lead column index map: 0 = lead, 1–3 = compacts, 4+ = headline links. */
const EDITORIAL_LEAD_COMPACT_END_INDEX = EDITORIAL_LEAD_IMAGE_COUNT + EDITORIAL_COMPACT_IMAGE_COUNT

export interface IEditorialLeadColumnSlices {
  leads: IArticle[]
  compacts: IArticle[]
  headlines: IArticle[]
}

/**
 * Find a feed slot by presentation type.
 *
 * @param slots Candidate feed slots.
 * @param presentationType Target presentation type.
 * @returns First slot matching the presentation type.
 */
export function findSlot(slots: IFeedSlot[], presentationType: string): IFeedSlot | undefined {
  return slots.find((slot) => slot.presentationType === presentationType)
}

/**
 * Normalize position key values for consistent comparisons.
 *
 * @param slot Feed slot to normalize.
 * @returns Lowercase normalized position key.
 */
export function normalizedPositionKey(slot: IFeedSlot): string {
  return slot.positionKey.trim().toLowerCase()
}

/**
 * Find a feed slot by position key (case-insensitive).
 *
 * @param slots Candidate feed slots.
 * @param positionKey Target position key.
 * @returns First matching slot.
 */
export function findSlotByPositionKey(slots: IFeedSlot[], positionKey: string): IFeedSlot | undefined {
  const normalized = positionKey.trim().toLowerCase()
  return slots.find((slot) => normalizedPositionKey(slot) === normalized)
}

/**
 * Find feed slots for the provided position-key sequence.
 *
 * @param slots Candidate feed slots.
 * @param positionKeys Ordered list of position keys.
 * @returns Matching slots in requested order.
 */
export function findSlotsByPositionKeys(slots: IFeedSlot[], positionKeys: readonly string[]): IFeedSlot[] {
  return positionKeys
    .map((positionKey) => findSlotByPositionKey(slots, positionKey))
    .filter((slot): slot is IFeedSlot => slot != null)
}

/**
 * Group editorial lead/spotlight/rail slot triplets into renderable bands.
 *
 * @param slots Homepage feed slots.
 * @returns Ordered editorial bands.
 */
export function buildEditorialBands(slots: IFeedSlot[]): IEditorialBandSlots[] {
  const bands: IEditorialBandSlots[] = []

  for (let index = 0; index < slots.length; index += 1) {
    const lead = slots[index]
    if (!lead || lead.presentationType !== PRESENTATION_EDITORIAL_LEAD) {
      continue
    }

    const spotlight = slots[index + 1]
    if (!spotlight || spotlight.presentationType !== PRESENTATION_EDITORIAL_SPOTLIGHT) {
      continue
    }

    const rail = slots[index + 2]
    if (rail && rail.presentationType === PRESENTATION_RAIL_COMPACT) {
      bands.push({ lead, spotlight, rail })
      index += 2
      continue
    }

    bands.push({ lead, spotlight })
    index += 1
  }

  return bands
}

/**
 * Collect ids used by editorial bands.
 *
 * @param bands Editorial band list.
 * @returns Set of slot ids used by bands.
 */
export function editorialSlotIds(bands: IEditorialBandSlots[]): Set<string> {
  const ids = new Set<string>()
  for (const band of bands) {
    ids.add(band.lead.id)
    ids.add(band.spotlight.id)
    if (band.rail) {
      ids.add(band.rail.id)
    }
  }
  return ids
}

function pickArticlesByIndices(articles: IArticle[], indices: readonly number[]): IArticle[] {
  return indices.map((index) => articles[index]).filter(Boolean) as IArticle[]
}

/**
 * Split hero articles into named homepage slices using explicit slot constants.
 *
 * @param articles Hero slot article list.
 * @returns Left rail, related links, strip, and right rail slices.
 */
export function splitDefaultHeroArticles(articles: IArticle[]): IDefaultHeroSlices {
  return {
    left: pickArticlesByIndices(articles, DEFAULT_HERO_LEFT_INDICES),
    relatedLinks: articles.slice(DEFAULT_HERO_RELATED_START_INDEX, DEFAULT_HERO_RELATED_END_INDEX).filter(Boolean) as IArticle[],
    strip: articles.slice(DEFAULT_HERO_STRIP_START_INDEX, DEFAULT_HERO_STRIP_END_INDEX).filter(Boolean) as IArticle[],
    rightCards: pickArticlesByIndices(articles, DEFAULT_HERO_RIGHT_INDICES),
  }
}

/**
 * Split Top Stories band articles into named homepage slices using explicit slot constants.
 *
 * @param articles Top Stories slot article list.
 * @returns Center hero, news screens, flank stories, and text-link slices.
 */
export function splitUsFeaturedArticles(articles: IArticle[]): IUsFeaturedBandSlices {
  const bandArticles = articles.slice(0, US_FEATURED_PINNED_LIMIT)

  return {
    center: bandArticles[US_FEATURED_CENTER_INDEX],
    centerTop: bandArticles.slice(
      US_FEATURED_CENTER_TOP_START_INDEX,
      US_FEATURED_CENTER_TOP_START_INDEX + US_FEATURED_CENTER_TOP_COUNT,
    ).filter(Boolean) as IArticle[],
    left: bandArticles.slice(
      US_FEATURED_LEFT_START_INDEX,
      US_FEATURED_LEFT_START_INDEX + US_FEATURED_LEFT_COUNT,
    ).filter(Boolean) as IArticle[],
    leftLinks: bandArticles.slice(
      US_FEATURED_LEFT_LINKS_START_INDEX,
      US_FEATURED_LEFT_LINKS_START_INDEX + US_FEATURED_LEFT_LINKS_COUNT,
    ).filter(Boolean) as IArticle[],
    right: bandArticles.slice(
      US_FEATURED_RIGHT_START_INDEX,
      US_FEATURED_RIGHT_START_INDEX + US_FEATURED_RIGHT_COUNT,
    ).filter(Boolean) as IArticle[],
    rightLinks: bandArticles.slice(
      US_FEATURED_RIGHT_LINKS_START_INDEX,
      US_FEATURED_RIGHT_LINKS_START_INDEX + US_FEATURED_RIGHT_LINKS_COUNT,
    ).filter(Boolean) as IArticle[],
  }
}

/**
 * Split More Top Stories articles into lead, compact, and headline slices.
 *
 * @param articles Editorial-lead slot article list.
 * @param maxArticles Optional cap before slicing (e.g. More Top Stories pinned limit).
 * @returns Lead image, side-thumbnail compacts, and text headline links.
 */
export function splitEditorialLeadColumnArticles(
  articles: IArticle[],
  maxArticles: number | null = null,
): IEditorialLeadColumnSlices {
  const columnArticles =
    maxArticles != null && maxArticles > 0 ? articles.slice(0, maxArticles) : articles

  return {
    leads: columnArticles.slice(0, EDITORIAL_LEAD_IMAGE_COUNT).filter(Boolean) as IArticle[],
    compacts: columnArticles.slice(
      EDITORIAL_LEAD_IMAGE_COUNT,
      EDITORIAL_LEAD_COMPACT_END_INDEX,
    ).filter(Boolean) as IArticle[],
    headlines: columnArticles.slice(EDITORIAL_LEAD_COMPACT_END_INDEX).filter(Boolean) as IArticle[],
  }
}

/**
 * Check whether a slot position key uses the More Top Stories editorial layout.
 *
 * @param positionKey Slot position key from layout metadata.
 * @returns True when the slot is a More Top Stories editorial-lead column.
 */
export function isMoreTopStoriesPositionKey(positionKey: string): boolean {
  const normalized = positionKey.trim().toLowerCase()
  return (MORE_TOP_STORIES_POSITION_KEYS as readonly string[]).includes(normalized)
}

/**
 * Check whether a slot uses insert-and-evict placement semantics.
 *
 * @param positionKey Slot position key from layout metadata.
 * @returns True when new stories shift existing ones down and drop the last item.
 */
export function isShiftDownPlacementPositionKey(positionKey: string): boolean {
  const normalized = positionKey.trim().toLowerCase()
  return (SHIFT_DOWN_PLACEMENT_POSITION_KEYS as readonly string[]).includes(normalized)
}
