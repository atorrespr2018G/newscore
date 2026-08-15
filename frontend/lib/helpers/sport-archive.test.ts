import type { IFeedSlot } from '@/interfaces/feed'
import {
  isSectionPageActive,
  sectionKeyFromPathname,
  sportPagePath,
} from '@/lib/helpers/section-labels'
import {
  archivePageHref,
  authorInitial,
  findSportArchiveSlot,
  parseArchivePage,
  splitSportArchiveLayout,
  sportArchiveHref,
} from '@/lib/helpers/sport-archive'

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

describe('sportPagePath', () => {
  it('builds a lowercase sports archive path', () => {
    expect(sportPagePath('Baseball')).toBe('/sports/baseball')
  })
})

describe('sectionKeyFromPathname', () => {
  it('treats nested sport archives as the sports section', () => {
    expect(sectionKeyFromPathname('/sports')).toBe('sports')
    expect(sectionKeyFromPathname('/sports/baseball')).toBe('sports')
    expect(sectionKeyFromPathname('/sports/baseball/')).toBe('sports')
  })

  it('does not treat unrelated paths as sports', () => {
    expect(sectionKeyFromPathname('/world')).toBe('world')
    expect(sectionKeyFromPathname('/')).toBeNull()
  })
})

describe('isSectionPageActive', () => {
  it('marks Sports active on nested sport archives', () => {
    expect(isSectionPageActive('/sports', 'sports')).toBe(true)
    expect(isSectionPageActive('/sports/baseball', 'sports')).toBe(true)
    expect(isSectionPageActive('/sports/baseball', 'world')).toBe(false)
  })
})

describe('sportArchiveHref', () => {
  it('links compact sport headings only on the sports page', () => {
    expect(sportArchiveHref('sports', 'baseball')).toBe('/sports/baseball')
    expect(sportArchiveHref('homepage', 'sports')).toBeNull()
    expect(sportArchiveHref('world', 'baseball')).toBeNull()
    expect(sportArchiveHref(undefined, 'baseball')).toBeNull()
  })
})

describe('parseArchivePage', () => {
  it('defaults invalid or missing page values to 1', () => {
    expect(parseArchivePage(undefined)).toBe(1)
    expect(parseArchivePage('0')).toBe(1)
    expect(parseArchivePage('-2')).toBe(1)
    expect(parseArchivePage('abc')).toBe(1)
    expect(parseArchivePage(['3'])).toBe(3)
  })
})

describe('archivePageHref', () => {
  it('omits the page query on the first page', () => {
    expect(archivePageHref('/sports/baseball', 1)).toBe('/sports/baseball')
    expect(archivePageHref('/sports/baseball', 2)).toBe('/sports/baseball?page=2')
  })
})

describe('findSportArchiveSlot', () => {
  it('matches compact sport rows and ignores hero or world slots', () => {
    const slots = [
      slot('hero', 'hero'),
      slot('world', 'featured_band'),
      slot('baseball', 'grid_4'),
    ]

    expect(findSportArchiveSlot(slots, 'baseball')?.id).toBe('slot-baseball')
    expect(findSportArchiveSlot(slots, 'hero')).toBeUndefined()
    expect(findSportArchiveSlot(slots, 'world')).toBeUndefined()
  })
})

describe('splitSportArchiveLayout', () => {
  it('places the newest story as featured, then four rail stories, then the grid', () => {
    const articles = Array.from({ length: 8 }, (_, index) => ({
      id: `a-${index}`,
      title: `Story ${index}`,
      slug: `story-${index}`,
      summary: null,
      status: 'published' as const,
      authorName: 'Author',
      thumbnailUrl: null,
      videoUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
      publishedAt: '2026-01-01T00:00:00Z',
    }))
    const layout = splitSportArchiveLayout(articles)

    expect(layout.featured?.id).toBe('a-0')
    expect(layout.rail.map((item) => item.id)).toEqual(['a-1', 'a-2', 'a-3', 'a-4'])
    expect(layout.grid.map((item) => item.id)).toEqual(['a-5', 'a-6', 'a-7'])
  })

  it('returns an empty layout when there are no stories', () => {
    expect(splitSportArchiveLayout([])).toEqual({ featured: null, rail: [], grid: [] })
  })
})

describe('authorInitial', () => {
  it('returns the uppercase first letter', () => {
    expect(authorInitial('Luis A. Meléndez')).toBe('L')
    expect(authorInitial('  ')).toBe('?')
  })
})
