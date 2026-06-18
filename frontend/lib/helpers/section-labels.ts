/** Maps layout slot position keys to navigation.sectionLabels translation keys. */

const SECTION_TRANSLATION_KEYS = new Set([

  'hero',

  'more-top-stories',

  'more-top-stories-2',

  'midterm-elections',

  'editorial-rail',

  'us',

  'us-featured',

  'world',

  'politics',

  'finance',

  'technology',

  'health',

  'entertainment',

  'style',

  'travel',

  'sports',

  'world-us-canada',

  'world-spotlight',

  'world-latin-america',

  'world-latest',

  'world-regions',

  'world-middle-east',

  'world-africa',

])



const HIDDEN_HOMEPAGE_SECTION_KEYS = new Set(['sport', 'travel', 'style', 'us', 'us-featured'])



/** Grid sections rendered directly below Politics on the homepage. */

export const HOMEPAGE_POST_POLITICS_SECTION_KEYS = [

  'sports',

  'health',

  'finance',

  'entertainment',

  'world',

  'technology',

] as const



const POST_POLITICS_SECTION_KEY_SET = new Set<string>(HOMEPAGE_POST_POLITICS_SECTION_KEYS)



export function isPostPoliticsSectionKey(positionKey: string): boolean {

  return POST_POLITICS_SECTION_KEY_SET.has(positionKey.trim().toLowerCase())

}



/** Homepage sections that use the six-card compact row layout (Entertainment-style). */

export const COMPACT_SIX_BAND_POSITION_KEYS = new Set([

  'entertainment',

  'sports',

  'finance',

  'politics',

  'technology',

  'world-latest',

  'world-regions',

  'world-middle-east',

  'world-africa',

])



export const COMPACT_SIX_BAND_ARTICLE_LIMIT = 6



export function isCompactSixBandPositionKey(positionKey: string): boolean {

  return COMPACT_SIX_BAND_POSITION_KEYS.has(positionKey.trim().toLowerCase())

}



export function isUsBandPositionKey(positionKey: string): boolean {

  const normalized = positionKey.trim().toLowerCase()

  return normalized === 'us' || normalized === 'us-featured'

}



/** Position keys whose heading comes from translations, not slot display_name in the CMS. */

const POSITION_KEY_OVERRIDES_DISPLAY_NAME = new Set([

  'hero',

  'more-top-stories',

  'more-top-stories-2',

  'midterm-elections',

  'editorial-rail',

  'us-featured',

  'world',

  'politics',

  'health',

  'finance',

  'technology',

  'sports',

  'entertainment',

  'world-spotlight',

  'world-latest',

  'world-regions',

  'world-middle-east',

  'world-africa',

])



/** Shared position keys that use different labels on the world page. */

const WORLD_PAGE_POSITION_LABEL_KEYS: Record<string, string> = {

  'more-top-stories': 'world-us-canada',

  'editorial-rail': 'world-latin-america',

}



export type SectionLabelTranslator = (

  key: 'sectionLabels.hero' | `sectionLabels.${string}`,

) => string



function titleCaseFromPositionKey(positionKey: string): string {

  return positionKey

    .split('-')

    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))

    .join(' ')

}



/**

 * Human-readable label for a homepage slot position key.

 */

export function sectionLabel(positionKey: string, translate?: SectionLabelTranslator): string {

  const normalized = positionKey.trim().toLowerCase()

  if (SECTION_TRANSLATION_KEYS.has(normalized) && translate) {

    return translate(`sectionLabels.${normalized}` as `sectionLabels.${string}`)

  }

  return titleCaseFromPositionKey(positionKey)

}



/**

 * Section heading for homepage modules. Prefers configured labels over stale CMS display names.

 */

export function homepageSectionTitle(

  positionKey: string,

  displayName?: string | null,

  translate?: SectionLabelTranslator,

  pageName?: string,

): string {

  const normalized = positionKey.trim().toLowerCase()

  if (pageName?.trim().toLowerCase() === 'world') {

    const worldLabelKey = WORLD_PAGE_POSITION_LABEL_KEYS[normalized]

    if (worldLabelKey && translate) {

      return translate(`sectionLabels.${worldLabelKey}` as `sectionLabels.${string}`)

    }

  }

  if (POSITION_KEY_OVERRIDES_DISPLAY_NAME.has(normalized)) {

    return sectionLabel(normalized, translate)

  }

  return displayName ?? sectionLabel(positionKey, translate)

}



/** Section keys that have a dedicated page route (instead of homepage anchors). */

const SECTION_PAGE_ROUTES: Record<string, string> = {

  world: '/world',

}



/** CMS page_name for section routes (defaults to the position key). */

const SECTION_PAGE_NAMES: Record<string, string> = {

  world: 'world',

}



/**

 * Dedicated page path for a section, if one exists.

 */

export function sectionPagePath(positionKey: string): string | null {

  const normalized = positionKey.trim().toLowerCase()

  return SECTION_PAGE_ROUTES[normalized] ?? null

}



/**

 * CMS layout page_name for a section page route.

 */

export function sectionPageName(positionKey: string): string {

  const normalized = positionKey.trim().toLowerCase()

  return SECTION_PAGE_NAMES[normalized] ?? normalized

}



/**

 * Masthead nav target: section page when configured, otherwise homepage anchor.

 */

export function sectionNavHref(positionKey: string): string {

  const pagePath = sectionPagePath(positionKey)

  if (pagePath) return pagePath

  return `/#${sectionAnchorId(positionKey)}`

}



/**

 * DOM id for in-page section anchors (masthead nav).

 */

export function sectionAnchorId(positionKey: string): string {

  return `section-${positionKey.trim().toLowerCase()}`

}



/**

 * Whether a homepage section should be rendered in section grids and nav.

 */

export function isHomepageSectionVisible(positionKey: string): boolean {

  return !HIDDEN_HOMEPAGE_SECTION_KEYS.has(positionKey.trim().toLowerCase())

}


