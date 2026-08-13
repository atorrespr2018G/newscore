/**
 * Allocate the next unused slug for a preferred prefix (`ad-ribbon`, `ad-ribbon-2`, …).
 *
 * @param prefix - Base slug without numeric suffix.
 * @param usedSlugs - Slugs already taken in the list.
 * @returns A slug not present in `usedSlugs`.
 */
export function nextUniqueSlug(prefix: string, usedSlugs: ReadonlySet<string>): string {
  const normalized = prefix.trim().toLowerCase()
  if (!normalized) {
    return nextUniqueSlug('section', usedSlugs)
  }
  if (!usedSlugs.has(normalized)) {
    return normalized
  }

  let suffix = 2
  while (usedSlugs.has(`${normalized}-${suffix}`)) {
    suffix += 1
  }
  return `${normalized}-${suffix}`
}

/**
 * Turn a display label into a slug seed.
 *
 * @param label - Section label.
 * @returns Hyphenated lowercase slug, or empty when blank.
 */
export function slugifySectionLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface IAllocateSectionSlugOptions {
  sectionType: string
  label: string
  usedSlugs: ReadonlySet<string>
  canonicalByType: Partial<Record<string, string>>
  preferredPrefixByType: Partial<Record<string, string>>
}

/**
 * Pick a unique slug for a newly added configuration section row.
 *
 * Assigns immediately so the row can be dragged anywhere before save without
 * colliding with existing preferred slugs like `ad-ribbon-3`.
 *
 * @param options - Section type, label, used slugs, and page-specific maps.
 * @returns A unique slug for the new row.
 */
export function allocateSectionSlug(options: IAllocateSectionSlugOptions): string {
  const { sectionType, label, usedSlugs, canonicalByType, preferredPrefixByType } = options

  if (sectionType === 'hero') {
    return canonicalByType.hero ?? 'hero'
  }

  const canonical = canonicalByType[sectionType]
  if (canonical && !usedSlugs.has(canonical)) {
    return canonical
  }

  const preferred = preferredPrefixByType[sectionType]
  if (preferred) {
    return nextUniqueSlug(preferred, usedSlugs)
  }

  const fromLabel = slugifySectionLabel(label)
  return nextUniqueSlug(fromLabel || sectionType, usedSlugs)
}
