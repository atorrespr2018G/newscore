import { parseArchivePage } from '@/lib/helpers/sport-archive'

/** CMS page name for the Technology landing page. */
export const TECHNOLOGY_PAGE_NAME = 'technology'

/** Pin-only archive slot on the Technology page (Baseball-style grid). */
export const TECHNOLOGY_ARCHIVE_POSITION_KEY = 'archive'

/** Articles shown per Technology archive page, newest first. */
export const TECHNOLOGY_ARCHIVE_PAGE_SIZE = 16

/** Placement targets for the Technology archive slot. */
export const TECHNOLOGY_ARCHIVE_PIN_LIMIT = 48

/** Public path for the Technology landing and its archive pagination. */
export const TECHNOLOGY_PAGE_PATH = '/technology'

/**
 * Parse a 1-indexed Technology archive page from a Next.js search param.
 *
 * @param raw Query value from `searchParams.page`.
 * @returns Page number, defaulting to 1 when missing or invalid.
 */
export function parseTechnologyArchivePage(raw: string | string[] | undefined): number {
  return parseArchivePage(raw)
}

/**
 * Whether a sports-style slot is the Technology date-ordered archive.
 *
 * @param positionKey Slot position key.
 * @returns True when the slot is the Technology archive band.
 */
export function isTechnologyArchivePositionKey(positionKey: string): boolean {
  return positionKey.trim().toLowerCase() === TECHNOLOGY_ARCHIVE_POSITION_KEY
}
