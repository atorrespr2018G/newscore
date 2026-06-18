/**
 * Build a clean excerpt with an ellipsis when truncation is required.
 *
 * @param text Source text.
 * @param maxChars Maximum output length.
 * @returns Normalized excerpt.
 */
export function excerpt(text: string, maxChars: number): string {
  const cleaned = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= maxChars) return cleaned
  return `${cleaned.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

const SEED_DEMO_BODY_PATTERN = /seeded demo content for/i

/**
 * Detect placeholder seed body copy that should be hidden in UI decks.
 *
 * @param text Candidate body text.
 * @returns True when the text matches seed-demo content.
 */
export function isSeedDemoBody(text: string | null | undefined): boolean {
  return SEED_DEMO_BODY_PATTERN.test(String(text ?? '').replace(/\s+/g, ' ').trim())
}

/** Clamp deck/headline copy that sits below lead media to three lines. */
export const BELOW_MEDIA_TEXT_CLASS = 'line-clamp-3 overflow-hidden'

/**
 * Append the shared below-media clamp class to an optional className.
 *
 * @param className Optional class list.
 * @returns Combined class string.
 */
export function belowMediaTextClass(className?: string): string {
  return [BELOW_MEDIA_TEXT_CLASS, className ?? ''].filter(Boolean).join(' ')
}

/**
 * Build deck copy shown below a separate headline, removing duplicated leading titles.
 *
 * @param title Headline text.
 * @param text Candidate deck/body text.
 * @param maxChars Maximum deck length.
 * @returns Cleaned deck copy or an empty string.
 */
export function deckBelowTitle(
  title: string,
  text: string | null | undefined,
  maxChars: number,
): string {
  const titleClean = String(title ?? '').replace(/\s+/g, ' ').trim()
  let body = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!body) {
    return ''
  }
  if (titleClean) {
    const titleLen = titleClean.length
    if (body.slice(0, titleLen).toLowerCase() === titleClean.toLowerCase()) {
      body = body.slice(titleLen).replace(/^[\s.,;:!?–—-]+/, '').trim()
    }
  }
  if (isSeedDemoBody(body) || !body) {
    return ''
  }
  return excerpt(body, maxChars)
}

/**
 * Build display text for text-link cards from title and summary.
 *
 * @param article Article headline and optional summary.
 * @returns Normalized link copy.
 */
export function textLinkDisplayText(article: { title: string; summary: string | null }): string {
  const title = String(article.title ?? '').replace(/\s+/g, ' ').trim()
  let summary = String(article.summary ?? '').replace(/\s+/g, ' ').trim()
  if (title && summary.slice(0, title.length).toLowerCase() === title.toLowerCase()) {
    summary = summary.slice(title.length).replace(/^[\s.,;:!?–—-]+/, '').trim()
  }
  if (!title) return summary
  if (!summary || isSeedDemoBody(summary)) return title
  if (summary.startsWith(title)) return summary
  return `${title}. ${summary}`
}

