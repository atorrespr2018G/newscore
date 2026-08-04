/**
 * Public-site ad configuration: delivery mode, slot registry, and layout variants.
 */

export const ADS_MODE_ENV_KEY = 'NEXT_PUBLIC_ADS_MODE'
export const DEFAULT_ADS_MODE: AdsMode = 'mock'

export type AdsMode = 'mock' | 'off' | 'gam'
export type AdSlotVariant = 'leaderboard' | 'ribbon' | 'rail' | 'tall' | 'square'

export type AdSlotKey =
  | 'masthead-leaderboard'
  | 'homepage-section-ribbon'
  | 'homepage-hero-after'
  | 'section-hero-rail'
  | 'section-grid-ribbon'
  | 'article-rail'
  | 'article-in-content'
  | 'homepage-us-band'
  | 'homepage-editorial-band'
  | 'homepage-health-carousel'

export interface IAdSlotDefinition {
  key: AdSlotKey
  variant: AdSlotVariant
}

const ADS_MODES = new Set<AdsMode>(['mock', 'off', 'gam'])

export const AD_SLOT_REGISTRY: Record<AdSlotKey, IAdSlotDefinition> = {
  'masthead-leaderboard': { key: 'masthead-leaderboard', variant: 'leaderboard' },
  'homepage-section-ribbon': { key: 'homepage-section-ribbon', variant: 'ribbon' },
  'homepage-hero-after': { key: 'homepage-hero-after', variant: 'ribbon' },
  'section-hero-rail': { key: 'section-hero-rail', variant: 'rail' },
  'section-grid-ribbon': { key: 'section-grid-ribbon', variant: 'ribbon' },
  'article-rail': { key: 'article-rail', variant: 'tall' },
  'article-in-content': { key: 'article-in-content', variant: 'ribbon' },
  'homepage-us-band': { key: 'homepage-us-band', variant: 'square' },
  'homepage-editorial-band': { key: 'homepage-editorial-band', variant: 'ribbon' },
  'homepage-health-carousel': { key: 'homepage-health-carousel', variant: 'square' },
}

/** Reserved shell classes that match current placeholder min-heights. */
export const AD_VARIANT_SHELL_CLASS: Record<AdSlotVariant, string> = {
  leaderboard: 'min-h-[250px] w-full',
  ribbon: 'min-h-[192px] w-full',
  rail: 'min-h-[250px] w-full',
  tall: 'min-h-[280px] w-full',
  square: 'aspect-[4/3] w-full min-h-[180px]',
}

/** Default ribbon min-height in px (matches AD_VARIANT_SHELL_CLASS.ribbon). */
export const RIBBON_AD_MIN_HEIGHT_PX = 192

/** Article in-content ribbon is 50% taller than the default ribbon (192 → 288). */
export const ARTICLE_RIBBON_AD_MIN_HEIGHT_PX = 288

/** Tailwind override for the taller article in-content ribbon (literal for JIT). */
export const ARTICLE_RIBBON_AD_SHELL_CLASS = '!min-h-[288px] w-full'

/**
 * Parse a raw ads mode string into a known mode.
 *
 * @param value - Raw env or override value.
 * @returns A valid ads mode, or the default when unset/invalid.
 */
export function parseAdsMode(value: string | undefined): AdsMode {
  if (!value) {
    return DEFAULT_ADS_MODE
  }

  const normalized = value.trim().toLowerCase()
  if (ADS_MODES.has(normalized as AdsMode)) {
    return normalized as AdsMode
  }

  return DEFAULT_ADS_MODE
}

/**
 * Resolve the active ads delivery mode from the public env var.
 *
 * @returns The configured ads mode (`mock` by default).
 */
export function getAdsMode(): AdsMode {
  return parseAdsMode(process.env[ADS_MODE_ENV_KEY])
}

/**
 * Look up the default layout variant for a registered slot.
 *
 * @param slotKey - Registered slot key.
 * @returns The slot's default variant.
 * @throws Error when the slot key is not registered.
 */
export function getSlotVariant(slotKey: AdSlotKey): AdSlotVariant {
  const definition = AD_SLOT_REGISTRY[slotKey]
  if (!definition) {
    throw new Error(`Unknown ad slot key: ${slotKey}`)
  }

  return definition.variant
}

/**
 * Whether mock creatives should be served for the given mode.
 *
 * @param mode - Active ads mode.
 * @returns True only for mock delivery.
 */
export function shouldServeMockAds(mode: AdsMode): boolean {
  return mode === 'mock'
}
