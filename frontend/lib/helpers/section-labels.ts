import enNavigation from '@/messages/en/navigation.json'

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

  'business',

  'health',

  'entertainment',

  'style',

  'travel',

  'sports',

  'archive',

  'baseball',

  'basketball',

  'boxing',

  'volleyball',

  'soccer',

  'surfing',

  'track-and-field',

  'tennis',

  'golf',

  'horse-racing',

  'world-us-canada',

  'world-spotlight',

  'world-latin-america',

  'world-latest',

  'world-regions',

  'world-middle-east',

  'world-africa',

  'usa-canada',

  'europe',

  'latin-america',

  'asia',

  'oceania',

  'middle-east',

  'africa',

  'economy',

  'companies',

  'banking',

  'autos',

  'tourism',

  'construction',

  'agriculture',

  'government',

  'executive',

  'legislature',

  'judiciary',

  'agencies',

  'services',

  'emergency',

  'defense',

  'arts-culture',

  'music',

  'movies',

  'tv-streaming',

  'celebrities',

  'fashion',

  'design',

  'architecture',

  'luxury',

  'gaming',

  'lifestyle',

  'horoscope',

  'fitness',

  'food',

  'sleep',

  'family',

])



const HIDDEN_HOMEPAGE_SECTION_KEYS = new Set([
  'sport',
  'us',
  'us-featured',
  'midterm-elections',
])



/** Grid sections rendered directly below Politics on the homepage. */

export const HOMEPAGE_POST_POLITICS_SECTION_KEYS = [

  'sports',

  'government',

  'health',

  'finance',

  'entertainment',

  'world',

  'technology',

  'business',

  'style',

  'travel',

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

  'midterm-elections',

  // Politics page topic rows (Policy, Courts & Law, State Politics, Opinion).
  'politics-latest',

  'politics-courts',

  'politics-state',

  'politics-opinion',

  'technology',

  'business',

  'style',

  'travel',

  'world-latest',

  'world-regions',

  'world-middle-east',

  'world-africa',

  // Sports page rows (per-country list); same compact carousel as landing/world.
  'baseball',

  'basketball',

  'boxing',

  'volleyball',

  'soccer',

  'surfing',

  'track-and-field',

  'tennis',

  'golf',

  'horse-racing',

  'economy',

  'companies',

  'banking',

  'autos',

  'tourism',

  'construction',

  'agriculture',

  'government',

  'executive',

  'legislature',

  'judiciary',

  'agencies',

  'services',

  'emergency',

  'defense',

  'arts-culture',

  'music',

  'movies',

  'tv-streaming',

  'celebrities',

  'fashion',

  'design',

  'architecture',

  'luxury',

  'gaming',

  'lifestyle',

  'horoscope',

  'fitness',

  'food',

  'sleep',

  'family',

])

/** Slots on the Sports page that are not compact sport rows. */
const SPORTS_PAGE_NON_COMPACT_KEYS = new Set([
  'hero',
  'us-featured',
  'us',
  'health',
  'world',
  'ad-ribbon',
  'archive',
])

/** Built-in landings whose extra rows use the compact six-card carousel. */
const COMPACT_SIX_LANDING_PAGE_NAMES = new Set([
  'sports',
  'government',
  'business',
  'technology',
  'entertainment',
  'health',
  'politics',
  'style',
  'travel',
])

/** Layout page names that are not market custom tabs. */
const BUILTIN_LAYOUT_PAGE_NAMES = new Set(['homepage', 'world', ...COMPACT_SIX_LANDING_PAGE_NAMES])

/**
 * Whether a landing page slot should render as a compact six-card row.
 *
 * @param pageName Layout page name such as `style`.
 * @param positionKey Slot position key.
 * @returns True for compact topic rows on built-in or custom-tab landings.
 */
function usesCompactSixLandingRows(pageName: string | undefined, positionKey: string): boolean {
  const page = pageName?.trim().toLowerCase()
  if (!page || SPORTS_PAGE_NON_COMPACT_KEYS.has(positionKey)) {
    return false
  }
  return COMPACT_SIX_LANDING_PAGE_NAMES.has(page) || !BUILTIN_LAYOUT_PAGE_NAMES.has(page)
}



export const COMPACT_SIX_BAND_ARTICLE_LIMIT = 6

/** Total articles fetched for paginated compact bands (e.g. Asia). */
export const COMPACT_SIX_BAND_EXTENDED_LIMIT = 12



/**
 * Whether a slot uses the landing/world compact six-card carousel.
 *
 * @param positionKey Slot position key.
 * @param pageName Optional layout page name (`sports` includes dynamic sport rows).
 * @returns True when HomepageCompactSixBand should render.
 */
export function isCompactSixBandPositionKey(positionKey: string, pageName?: string): boolean {
  const normalized = positionKey.trim().toLowerCase()
  if (normalized === 'ad-ribbon' || normalized.startsWith('ad-ribbon-')) {
    return false
  }
  if (COMPACT_SIX_BAND_POSITION_KEYS.has(normalized)) {
    return true
  }
  return usesCompactSixLandingRows(pageName, normalized)
}



export function isUsBandPositionKey(positionKey: string): boolean {

  const normalized = positionKey.trim().toLowerCase()

  return normalized === 'us' || normalized === 'us-featured'

}

const HOMEPAGE_PAGE_NAME = 'homepage'

/**
 * Whether the main-page USA / Top Stories band should be omitted.
 *
 * USA editions are already US news, so the USA module is redundant there.
 *
 * @param marketCode Reader or editor market code.
 * @param pageName Layout page name such as `homepage`.
 * @param positionKey Slot position key.
 * @returns True for `us` / `us-featured` on the US homepage.
 */
export function shouldOmitUsaHomepageSection(
  marketCode: string,
  pageName: string | undefined,
  positionKey: string,
): boolean {
  if (marketCode.trim().toLowerCase() !== 'us') {
    return false
  }
  const page = (pageName ?? HOMEPAGE_PAGE_NAME).trim().toLowerCase()
  if (page !== HOMEPAGE_PAGE_NAME) {
    return false
  }
  return isUsBandPositionKey(positionKey)
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

  'business',

  'style',

  'travel',

  'sports',

  'archive',

  'entertainment',

  'world-spotlight',

  'world-latest',

  'world-regions',

  'world-middle-east',

  'world-africa',

  'economy',

  'companies',

  'banking',

  'autos',

  'tourism',

  'construction',

  'agriculture',

  'government',

  'executive',

  'legislature',

  'judiciary',

  'agencies',

  'services',

  'emergency',

  'defense',

  'arts-culture',

  'music',

  'movies',

  'tv-streaming',

  'celebrities',

  'fashion',

  'design',

  'architecture',

  'luxury',

  'gaming',

  'lifestyle',

  'horoscope',

  'fitness',

  'food',

  'sleep',

  'family',

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

 * Localized display label for an article category.

 *

 * Categories are stored single-language in the backend (only `name`), so the UI

 * resolves a localized label from the shared `navigation.sectionLabels`

 * dictionary keyed by the category slug, falling back to the stored name when no

 * translation exists for that slug.

 *

 * @param slug Category slug (matches a section-label key when localizable).

 * @param name Stored single-language category name, used as the fallback.

 * @param translate Optional section-label translator.

 * @returns Localized category label, or the stored name when unmapped.

 */

export function categoryLabel(

  slug: string,

  name: string,

  translate?: SectionLabelTranslator,

): string {

  const normalized = slug.trim().toLowerCase()

  if (SECTION_TRANSLATION_KEYS.has(normalized) && translate) {

    return translate(`sectionLabels.${normalized}` as `sectionLabels.${string}`)

  }

  return name

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

  // Sports / Economía pages: prefer i18n labels; CMS names for custom rows only.
  const page = pageName?.trim().toLowerCase()
  if (page === 'sports' || page === 'business' || page === 'government' || page === 'entertainment' || page === 'health') {
    if (SECTION_TRANSLATION_KEYS.has(normalized) && translate) {
      return translate(`sectionLabels.${normalized}` as `sectionLabels.${string}`)
    }
    if (displayName?.trim()) {
      return displayName.trim()
    }
  }
  // Politics page topic rows (Policy, Courts & Law, …) use CMS display names.
  if (page === 'politics' && displayName?.trim()) {
    return displayName.trim()
  }
  // Custom tab pages: prefer CMS display names for dynamic topic rows.
  if (page && displayName?.trim()) {
    return displayName.trim()
  }

  if (POSITION_KEY_OVERRIDES_DISPLAY_NAME.has(normalized)) {

    return sectionLabel(normalized, translate)

  }

  return displayName ?? sectionLabel(positionKey, translate)

}



/** Section keys that have a dedicated page route (instead of homepage anchors). */

const SECTION_PAGE_ROUTES: Record<string, string> = {

  politics: '/politics',

  world: '/world',

  sports: '/sports',

  government: '/government',

  entertainment: '/entertainment',

  finance: '/health',

  business: '/business',

  technology: '/technology',

  style: '/style',

  travel: '/travel',

}



/** CMS page_name for section routes (defaults to the position key). */

const SECTION_PAGE_NAMES: Record<string, string> = {

  politics: 'politics',

  world: 'world',

  sports: 'sports',

  government: 'government',

  entertainment: 'entertainment',

  finance: 'health',

  business: 'business',

  technology: 'technology',

  style: 'style',

  travel: 'travel',

}



/**

 * Dedicated page path for a section, if one exists.

 */

export function sectionPagePath(positionKey: string): string | null {

  const normalized = positionKey.trim().toLowerCase()

  return SECTION_PAGE_ROUTES[normalized] ?? null

}



/**
 * Dedicated archive path for a sport slug on the Sports page.
 *
 * @param slug Sport section slug such as `baseball`.
 * @returns Path like `/sports/baseball`.
 */
export function sportPagePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/sports/${encodeURIComponent(normalized)}`
}


/**
 * Dedicated archive path for a Government topic slug.
 *
 * @param slug Topic section slug such as `executive`.
 * @returns Path like `/government/executive`.
 */
export function governmentPagePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/government/${encodeURIComponent(normalized)}`
}


/**
 * Dedicated archive path for an Entertainment topic slug.
 *
 * @param slug Topic section slug such as `music`.
 * @returns Path like `/entertainment/music`.
 */
export function entertainmentPagePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/entertainment/${encodeURIComponent(normalized)}`
}


/**
 * Dedicated archive path for a Health topic slug.
 *
 * @param slug Topic section slug such as `fitness`.
 * @returns Path like `/health/fitness`.
 */
export function healthPagePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/health/${encodeURIComponent(normalized)}`
}


/**
 * Dedicated archive path for a Politics topic slug.
 *
 * @param slug Topic section slug such as `congress`.
 * @returns Path like `/politics/congress`.
 */
export function politicsPagePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/politics/${encodeURIComponent(normalized)}`
}


/**
 * Dedicated archive path for a World region slug.
 *
 * @param slug Region section slug such as `europe`.
 * @returns Path like `/world/europe`.
 */
export function worldPagePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/world/${encodeURIComponent(normalized)}`
}


/**
 * Dedicated archive path for an Economía beat slug.
 *
 * @param slug Beat section slug such as `autos`.
 * @returns Path like `/business/autos`.
 */
export function businessPagePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/business/${encodeURIComponent(normalized)}`
}


/**
 * Section key for a dedicated page route pathname, if one matches.
 *
 * @param pathname Current app pathname (locale prefix already stripped).
 * @returns Position key such as `sports`, or null on homepage and other routes.
 */
export function sectionKeyFromPathname(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  for (const [key, path] of Object.entries(SECTION_PAGE_ROUTES)) {
    if (normalized === path || normalized.startsWith(`${path}/`)) {
      return key
    }
  }
  return null
}

/**
 * Whether the current pathname is a section page or a nested archive under it.
 *
 * @param pathname Current app pathname (locale prefix already stripped).
 * @param positionKey Section position key such as `sports`.
 * @returns True when the masthead item should render as active.
 */
export function isSectionPageActive(pathname: string, positionKey: string): boolean {
  const pagePath = sectionPagePath(positionKey)
  if (!pagePath) {
    return false
  }
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return normalized === pagePath || normalized.startsWith(`${pagePath}/`)
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



const HOMEPAGE_LAYOUT_PAGE_NAME = 'homepage'

/**
 * Dedicated landing href for a homepage section heading (Sports, World, Business).
 *
 * Nested archives on those landings still use sport/world/business archive helpers.
 * Homepage bands use this so the heading opens the matching page.
 *
 * @param pageName Layout page name such as `homepage` or `sports`.
 * @param positionKey Slot position key such as `sports`.
 * @returns Path like `/sports`, or null when this heading should stay plain.
 */
export function homepageSectionLandingHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  const currentPage = pageName?.trim().toLowerCase() ?? HOMEPAGE_LAYOUT_PAGE_NAME
  if (currentPage !== HOMEPAGE_LAYOUT_PAGE_NAME) {
    return null
  }
  return sectionPagePath(positionKey)
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
  const key = positionKey.trim().toLowerCase()
  if (key === 'ad-ribbon' || key.startsWith('ad-ribbon-')) {
    return false
  }
  return !HIDDEN_HOMEPAGE_SECTION_KEYS.has(key)
}



/**

 * Resolve a section label from the bundled English navigation messages.

 *

 * Lets non-React (pure) helpers reuse the canonical position-key labels without

 * a `next-intl` hook, keeping editor surfaces consistent with the live site.

 *

 * @param key Section-label translation key (e.g. `sectionLabels.health`).

 * @returns The English label, or the bare position key when unmapped.

 */

export const staticSectionLabelTranslator: SectionLabelTranslator = (key) => {

  const positionKey = key.replace('sectionLabels.', '')

  const labels = enNavigation.sectionLabels as Record<string, string>

  return labels[positionKey] ?? positionKey

}


