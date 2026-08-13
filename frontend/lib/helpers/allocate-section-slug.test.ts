import {
  allocateSectionSlug,
  nextUniqueSlug,
  slugifySectionLabel,
} from '@/lib/helpers/allocate-section-slug'

describe('nextUniqueSlug', () => {
  it('returns the prefix when free and suffixes when taken', () => {
    expect(nextUniqueSlug('ad-ribbon', new Set())).toBe('ad-ribbon')
    expect(nextUniqueSlug('ad-ribbon', new Set(['ad-ribbon']))).toBe('ad-ribbon-2')
    expect(
      nextUniqueSlug('ad-ribbon', new Set(['ad-ribbon', 'ad-ribbon-2', 'ad-ribbon-3'])),
    ).toBe('ad-ribbon-4')
  })
})

describe('allocateSectionSlug', () => {
  const preferredPrefixByType = {
    ribbon_ad: 'ad-ribbon',
    more_top_stories: 'more-top-stories',
    spotlight: 'midterm-elections',
    rail: 'editorial-rail',
  }
  const canonicalByType = {
    hero: 'hero',
    top_stories: 'us-featured',
    live: 'health',
  }

  it('allocates the next free ribbon slug among existing ribbons', () => {
    const used = new Set(['ad-ribbon', 'ad-ribbon-2', 'ad-ribbon-3'])
    expect(
      allocateSectionSlug({
        sectionType: 'ribbon_ad',
        label: 'Ribbon Advertisement',
        usedSlugs: used,
        canonicalByType,
        preferredPrefixByType,
      }),
    ).toBe('ad-ribbon-4')
  })

  it('slugifies category labels uniquely', () => {
    expect(slugifySectionLabel('Track and Field')).toBe('track-and-field')
    expect(
      allocateSectionSlug({
        sectionType: 'category',
        label: 'Politics',
        usedSlugs: new Set(['politics']),
        canonicalByType,
        preferredPrefixByType,
      }),
    ).toBe('politics-2')
  })
})
