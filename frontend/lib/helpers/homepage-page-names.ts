/** Layout page name for the main homepage. */
export const HOMEPAGE_PAGE_NAME = 'homepage'
/** Layout page name for Sports. */
export const SPORTS_PAGE_NAME = 'sports'
/** Layout page name for Business / Economía. */
export const BUSINESS_PAGE_NAME = 'business'
/** Layout page name for Government. */
export const GOVERNMENT_PAGE_NAME = 'government'
/** Layout page name for Entertainment. */
export const ENTERTAINMENT_PAGE_NAME = 'entertainment'
/** Layout page name for Health. */
export const HEALTH_PAGE_NAME = 'health'
/** Layout page name for Technology. */
export const TECHNOLOGY_PAGE_NAME = 'technology'
/** Layout page name for Style. */
export const STYLE_PAGE_NAME = 'style'
/** Layout page name for Travel. */
export const TRAVEL_PAGE_NAME = 'travel'

/** Max articles shown in a homepage live carousel. */
export const LIVE_CAROUSEL_ARTICLE_LIMIT = 20

const SPORTS_STYLE_PAGE_NAMES: readonly string[] = [
  SPORTS_PAGE_NAME,
  BUSINESS_PAGE_NAME,
  GOVERNMENT_PAGE_NAME,
  ENTERTAINMENT_PAGE_NAME,
  HEALTH_PAGE_NAME,
  TECHNOLOGY_PAGE_NAME,
  STYLE_PAGE_NAME,
  TRAVEL_PAGE_NAME,
]

/**
 * Whether a layout page uses the sports-style section stack.
 *
 * @param pageName Normalized layout page name.
 * @returns True when the page renders sports-style sections.
 */
export function isSportsStylePageName(pageName: string): boolean {
  return SPORTS_STYLE_PAGE_NAMES.includes(pageName)
}
