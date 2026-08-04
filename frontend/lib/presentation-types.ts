/** Homepage slot presentation types (must match backend/shared/core/markets.py). */

export const PRESENTATION_HERO = 'hero'
export const PRESENTATION_EDITORIAL_LEAD = 'editorial_lead'
export const PRESENTATION_EDITORIAL_SPOTLIGHT = 'editorial_spotlight'
export const PRESENTATION_RAIL_COMPACT = 'rail_compact'
export const PRESENTATION_GRID_4 = 'grid_4'
/** Top Stories / World-style three-column band on the Sports page. */
export const PRESENTATION_FEATURED_BAND = 'featured_band'
/** Live carousel band on the Sports page. */
export const PRESENTATION_LIVE_CAROUSEL = 'live_carousel'
/** Configurable horizontal ribbon advertisement between page sections. */
export const PRESENTATION_RIBBON_AD = 'ribbon_ad'

export const EDITORIAL_PRESENTATION_TYPES = new Set([
  PRESENTATION_EDITORIAL_LEAD,
  PRESENTATION_EDITORIAL_SPOTLIGHT,
  PRESENTATION_RAIL_COMPACT,
])
