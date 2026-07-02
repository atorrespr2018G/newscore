import DOMPurify from 'isomorphic-dompurify'

/** Number of body blocks rendered between interleaved ad units. */
export const BODY_CHUNK_SIZE = 4

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3',
  'blockquote', 'ul', 'ol', 'li', 'a', 'code', 'pre',
]
const ALLOWED_ATTR = ['href', 'rel', 'target']

// Matches a single top-level block element (non-nested) of the editor allowlist.
const BLOCK_TAG_PATTERN = /<(p|h2|h3|blockquote|ul|ol|pre)\b[\s\S]*?<\/\1>/gi
// Detects whether a body string already contains rich-text HTML markup.
const HTML_DETECT_PATTERN = /<(p|h2|h3|ul|ol|blockquote|pre|strong|em|a|br|code)\b/i

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

/**
 * Convert a stored article body into ad-interleavable HTML chunks.
 *
 * The body is sanitized, split into top-level blocks (or paragraphs for legacy
 * plain text), then grouped into fixed-size chunks so the rail/ribbon ad layout
 * can render between them. Chunk count follows content length; media-only
 * articles still get one empty chunk so the lead gallery can render.
 *
 * @param body Stored body HTML string.
 * @returns Array of sanitized HTML strings, one per ad chunk.
 */
export function articleBodyHtmlChunks(body: string): string[] {
  const sanitized = sanitizeBodyHtml(typeof body === 'string' ? body : '')
  const blocks = bodyToBlocks(sanitized)

  if (blocks.length === 0) {
    return ['']
  }

  const chunks: string[] = []
  for (let idx = 0; idx < blocks.length; idx += BODY_CHUNK_SIZE) {
    chunks.push(blocks.slice(idx, idx + BODY_CHUNK_SIZE).join(''))
  }
  return chunks
}
