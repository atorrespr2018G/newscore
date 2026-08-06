/** Shared limits and helpers for reporter-parity media title/description editing. */

/** Maximum allowed length for a media headline (mirrors NewsCore reporter). */
export const MAX_TITLE_LENGTH = 200

/** Minimum allowed length for a media headline (mirrors NewsCore reporter). */
export const MIN_TITLE_LENGTH = 3

/** Minimum plain-text characters required in a rich description. */
export const MIN_DESCRIPTION_TEXT_LENGTH = 10

/** Maximum stored HTML length for a rich description. */
export const MAX_DESCRIPTION_HTML_LENGTH = 20_000

/**
 * Count trimmed plain-text characters inside rich-text HTML.
 * @param html - Rich-text editor HTML output.
 * @returns Number of non-whitespace-trimmed text characters.
 */
export function htmlTextLength(html: string): number {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, '').trim().length
  }
  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent ?? '').trim().length
}

/**
 * Normalize stored description text into HTML the rich-text editor can load.
 * @param value - Existing plain text or HTML description.
 * @returns HTML suitable for TipTap content.
 */
export function toDescriptionHtml(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return '<p></p>'
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${escaped}</p>`
}

/**
 * Validate media title and description using reporter-equivalent rules.
 * @param title - Headline text.
 * @param descriptionHtml - Rich description HTML.
 * @returns An error message, or null when valid.
 */
export function validateMediaMetadata(title: string, descriptionHtml: string): string | null {
  if (title.trim().length < MIN_TITLE_LENGTH) {
    return `Headline must be at least ${MIN_TITLE_LENGTH} characters`
  }
  if (htmlTextLength(descriptionHtml) < MIN_DESCRIPTION_TEXT_LENGTH) {
    return `Description must be at least ${MIN_DESCRIPTION_TEXT_LENGTH} characters`
  }
  if (descriptionHtml.length > MAX_DESCRIPTION_HTML_LENGTH) {
    return `Description is too long (max ${MAX_DESCRIPTION_HTML_LENGTH} characters including formatting)`
  }
  return null
}
