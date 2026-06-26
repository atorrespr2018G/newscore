import DOMPurify from 'isomorphic-dompurify'

/** Number of body blocks rendered between interleaved ad units. */
export const BODY_CHUNK_SIZE = 4
const MIN_BODY_SETS = 4
const MIN_BLOCK_COUNT = BODY_CHUNK_SIZE * MIN_BODY_SETS

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3',
  'blockquote', 'ul', 'ol', 'li', 'a', 'code', 'pre',
]
const ALLOWED_ATTR = ['href', 'rel', 'target']

// Matches a single top-level block element (non-nested) of the editor allowlist.
const BLOCK_TAG_PATTERN = /<(p|h2|h3|blockquote|ul|ol|pre)\b[\s\S]*?<\/\1>/gi
// Detects whether a body string already contains rich-text HTML markup.
const HTML_DETECT_PATTERN = /<(p|h2|h3|ul|ol|blockquote|pre|strong|em|a|br|code)\b/i

const FALLBACK_PARAGRAPHS = [
  'NewsCore continues to follow the latest developments and update this report as new details are confirmed by reporters and public officials.',
  'Editors are organizing the key facts, the local reaction, and the broader national context so readers can follow the story with clear updates throughout the day.',
  'Additional reporting is expected to expand on the timeline, explain what changed, and highlight the people, places, and decisions at the center of this event.',
  'Audience interest remains strong, so this article view includes extended copy blocks to preview the full long-form presentation and advertising layout.',
]

/**
 * Sanitize stored article HTML to the editor allowlist (defense in depth).
 *
 * @param html Raw stored body HTML.
 * @returns Sanitized HTML safe for `dangerouslySetInnerHTML`.
 */
export function sanitizeBodyHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

/**
 * Strip all tags from an HTML string, collapsing whitespace.
 *
 * @param html HTML to convert to plain text.
 * @returns Trimmed, single-spaced plain text.
 */
export function htmlToPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function plainTextToBlocks(body: string): string[] {
  const normalized = body.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return []
  }
  const byBlankLine = normalized
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
  const paragraphs = byBlankLine.length > 1 ? byBlankLine : normalized.split(/\n+/)
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
}

function bodyToBlocks(body: string): string[] {
  if (HTML_DETECT_PATTERN.test(body)) {
    return (body.match(BLOCK_TAG_PATTERN) ?? []).map((block) => block.trim())
  }
  return plainTextToBlocks(body)
}

function padBlocks(blocks: string[], headline: string): string[] {
  const padded = [...blocks]
  let idx = 0
  while (padded.length < MIN_BLOCK_COUNT) {
    const template = FALLBACK_PARAGRAPHS[idx % FALLBACK_PARAGRAPHS.length]
    padded.push(`<p>${escapeHtml(`${headline}: ${template}`)}</p>`)
    idx += 1
  }
  return padded
}

/**
 * Convert a stored article body into ad-interleavable HTML chunks.
 *
 * The body is sanitized, split into top-level blocks (or paragraphs for legacy
 * plain text), padded to a minimum length, then grouped into fixed-size chunks
 * so the existing rail/ribbon ad layout can render between them.
 *
 * @param options Stored body string and headline used for fallback padding.
 * @returns Array of sanitized HTML strings, one per ad chunk.
 */
export function articleBodyHtmlChunks(options: { body: string; headline: string }): string[] {
  const sanitized = sanitizeBodyHtml(typeof options.body === 'string' ? options.body : '')
  const blocks = padBlocks(bodyToBlocks(sanitized), options.headline)
  const chunks: string[] = []
  for (let idx = 0; idx < blocks.length; idx += BODY_CHUNK_SIZE) {
    chunks.push(blocks.slice(idx, idx + BODY_CHUNK_SIZE).join(''))
  }
  return chunks
}
