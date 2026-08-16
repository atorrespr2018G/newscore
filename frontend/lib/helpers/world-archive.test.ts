import type { IFeedSlot } from '@/interfaces/feed'
import {
  isSectionPageActive,
  sectionKeyFromPathname,
  worldPagePath,
} from '@/lib/helpers/section-labels'
import {
  findWorldArchiveSlot,
  isWorldRegionArchiveSlot,
  archiveConnectionFromArticles,
  worldArchiveCategorySlugs,
  worldArchiveHref,
  worldRegionArchiveSlug,
  worldRegionCategorySlug,
} from '@/lib/helpers/world-archive'

function slot(positionKey: string, presentationType: string): IFeedSlot {
  return {
    id: `slot-${positionKey}`,
    positionKey,
    displayName: positionKey,
    presentationType,
    contentType: 'articles',
    articles: [],
  }
}

describe('worldPagePath', () => {
  it('builds a lowercase world region archive path', () => {
    expect(worldPagePath('Europe')).toBe('/world/europe')
  })
})

describe('sectionKeyFromPathname', () => {
  it('treats nested world archives as the world section', () => {
    expect(sectionKeyFromPathname('/world')).toBe('world')
    expect(sectionKeyFromPathname('/world/europe')).toBe('world')
    expect(sectionKeyFromPathname('/world/europe/')).toBe('world')
  })
})

describe('isSectionPageActive', () => {
  it('marks World active on nested region archives', () => {
    expect(isSectionPageActive('/world', 'world')).toBe(true)
    expect(isSectionPageActive('/world/europe', 'world')).toBe(true)
    expect(isSectionPageActive('/world/europe', 'sports')).toBe(false)
  })
})

describe('worldRegionArchiveSlug', () => {
  it('maps seeded position keys to friendly region slugs', () => {
    expect(worldRegionArchiveSlug('world-spotlight')).toBe('europe')
    expect(worldRegionArchiveSlug('editorial-rail')).toBe('latin-america')
    expect(worldRegionArchiveSlug('world-latest')).toBe('asia')
    expect(worldRegionArchiveSlug('custom-region')).toBe('custom-region')
  })
})

describe('worldRegionCategorySlug', () => {
  it('keeps compact-band category slugs and maps editorial regions', () => {
    expect(worldRegionCategorySlug('world-spotlight')).toBe('europe')
    expect(worldRegionCategorySlug('world-latest')).toBe('world-latest')
    expect(worldRegionCategorySlug('editorial-rail')).toBe('latin-america')
  })
})

describe('worldArchiveCategorySlugs', () => {
  it('queries the World pool the landing page already shows', () => {
    expect(worldArchiveCategorySlugs('world-spotlight')).toEqual(['world', 'europe'])
    expect(worldArchiveCategorySlugs('world-latest')).toEqual(['world', 'world-latest'])
    expect(worldArchiveCategorySlugs('editorial-rail')).toEqual(['world', 'latin-america'])
  })
})

describe('archiveConnectionFromArticles', () => {
  it('keeps slot stories so a region archive is not empty', () => {
    const articles = [
      {
        id: 'a1',
        title: 'Europe briefing',
        slug: 'europe-briefing',
        summary: null,
        status: 'published' as const,
        authorName: 'Staff',
        thumbnailUrl: null,
        videoUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        publishedAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    const connection = archiveConnectionFromArticles(articles, 1)
    expect(connection.total).toBe(1)
    expect(connection.items[0].title).toBe('Europe briefing')
  })
})

describe('worldArchiveHref', () => {
  it('links region headings only on the world page', () => {
    expect(worldArchiveHref('world', 'world-spotlight')).toBe('/world/europe')
    expect(worldArchiveHref('world', 'editorial-rail')).toBe('/world/latin-america')
    expect(worldArchiveHref('world', 'hero')).toBeNull()
    expect(worldArchiveHref('sports', 'world-spotlight')).toBeNull()
    expect(worldArchiveHref('homepage', 'world-latest')).toBeNull()
  })
})

describe('isWorldRegionArchiveSlot', () => {
  it('accepts region rows and ignores hero, live, and ads', () => {
    expect(isWorldRegionArchiveSlot(slot('world-spotlight', 'editorial_spotlight'))).toBe(true)
    expect(isWorldRegionArchiveSlot(slot('world-latest', 'grid_4'))).toBe(true)
    expect(isWorldRegionArchiveSlot(slot('hero', 'hero'))).toBe(false)
    expect(isWorldRegionArchiveSlot(slot('ad-ribbon', 'ribbon_ad'))).toBe(false)
  })
})

describe('findWorldArchiveSlot', () => {
  it('matches friendly slugs and position keys, ignoring hero', () => {
    const slots = [
      slot('hero', 'hero'),
      slot('world-spotlight', 'editorial_spotlight'),
      slot('world-latest', 'grid_4'),
    ]

    expect(findWorldArchiveSlot(slots, 'europe')?.id).toBe('slot-world-spotlight')
    expect(findWorldArchiveSlot(slots, 'world-spotlight')?.id).toBe('slot-world-spotlight')
    expect(findWorldArchiveSlot(slots, 'asia')?.id).toBe('slot-world-latest')
    expect(findWorldArchiveSlot(slots, 'hero')).toBeUndefined()
  })
})
