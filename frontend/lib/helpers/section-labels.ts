/** Maps layout slot position keys to CNN-style section headings. */
const SECTION_LABELS: Record<string, string> = {
  hero: 'Top Stories',
  'more-top-stories': 'More Top Stories',
  'midterm-elections': 'Midterm elections',
  'editorial-rail': 'Featured',
  us: 'US',
  world: 'World',
  politics: 'Politics',
  business: 'Business',
  health: 'Health',
  entertainment: 'Entertainment',
  style: 'Style',
  travel: 'Travel',
  sports: 'Sports',
}

/**
 * Human-readable label for a homepage slot position key.
 */
export function sectionLabel(positionKey: string): string {
  const normalized = positionKey.trim().toLowerCase()
  if (SECTION_LABELS[normalized]) {
    return SECTION_LABELS[normalized]
  }
  return positionKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * DOM id for in-page section anchors (masthead nav).
 */
export function sectionAnchorId(positionKey: string): string {
  return `section-${positionKey.trim().toLowerCase()}`
}
