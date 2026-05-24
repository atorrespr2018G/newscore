import type { StoryCardVariant } from '@/components/ui/story-card'
import {
  EDITORIAL_PRESENTATION_TYPES,
  PRESENTATION_EDITORIAL_LEAD,
  PRESENTATION_EDITORIAL_SPOTLIGHT,
  PRESENTATION_GRID_4,
  PRESENTATION_HERO,
  PRESENTATION_RAIL_COMPACT,
} from '@/lib/presentation-types'

/** Maps slot presentationType to the default StoryCard variant. */
export const CARD_VARIANT_BY_PRESENTATION: Record<string, StoryCardVariant> = {
  [PRESENTATION_HERO]: 'hero-lead',
  [PRESENTATION_EDITORIAL_LEAD]: 'rail',
  [PRESENTATION_EDITORIAL_SPOTLIGHT]: 'rail',
  [PRESENTATION_RAIL_COMPACT]: 'compact',
  [PRESENTATION_GRID_4]: 'grid',
}

export type SlotModuleKind = 'hero' | 'editorial-band' | 'grid-section'

/** Maps presentationType to the homepage layout module that renders the slot. */
export const MODULE_KIND_BY_PRESENTATION: Record<string, SlotModuleKind> = {
  [PRESENTATION_HERO]: 'hero',
  [PRESENTATION_EDITORIAL_LEAD]: 'editorial-band',
  [PRESENTATION_EDITORIAL_SPOTLIGHT]: 'editorial-band',
  [PRESENTATION_RAIL_COMPACT]: 'editorial-band',
  [PRESENTATION_GRID_4]: 'grid-section',
}

export function cardVariantForPresentation(presentationType: string): StoryCardVariant {
  return CARD_VARIANT_BY_PRESENTATION[presentationType] ?? 'grid'
}

export function moduleKindForPresentation(presentationType: string): SlotModuleKind {
  return MODULE_KIND_BY_PRESENTATION[presentationType] ?? 'grid-section'
}

export function isEditorialPresentation(presentationType: string): boolean {
  return EDITORIAL_PRESENTATION_TYPES.has(presentationType)
}

export {
  PRESENTATION_EDITORIAL_LEAD,
  PRESENTATION_EDITORIAL_SPOTLIGHT,
  PRESENTATION_GRID_4,
  PRESENTATION_HERO,
  PRESENTATION_RAIL_COMPACT,
}
