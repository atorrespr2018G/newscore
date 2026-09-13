import type { IFeedSlot } from '@/interfaces/feed'
import {
  isSectionPageActive,
  sectionKeyFromPathname,
  politicsPagePath,
} from '@/lib/helpers/section-labels'
import {
  archiveConnectionFromPoliticsArticles,
  findPoliticsArchiveSlot,
  isPoliticsTopicArchiveSlot,
  politicsArchiveCategorySlugs,
  politicsArchiveHref,
  politicsTopicArchiveSlug,
  politicsTopicCategorySlug,
} from '@/lib/helpers/politics-archive'

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

describe('politicsPagePath', () => {
  it('builds a lowercase politics topic archive path', () => {
    expect(politicsPagePath('Congress')).toBe('/politics/congress')
    expect(politicsPagePath('policy')).toBe('/politics/policy')
  })
})

describe('sectionKeyFromPathname', () => {
  it('treats nested politics archives as the politics section', () => {
    expect(sectionKeyFromPathname('/politics')).toBe('politics')
    expect(sectionKeyFromPathname('/politics/congress')).toBe('politics')
    expect(sectionKeyFromPathname('/politics/policy/')).toBe('politics')
  })
})

describe('isSectionPageActive', () => {
  it('marks Politics active on nested topic archives', () => {
    expect(isSectionPageActive('/politics', 'politics')).toBe(true)
    expect(isSectionPageActive('/politics/congress', 'politics')).toBe(true)
    expect(isSectionPageActive('/politics/policy', 'sports')).toBe(false)
  })
})

describe('politicsTopicArchiveSlug', () => {
  it('maps seeded position keys to friendly topic slugs', () => {
    expect(politicsTopicArchiveSlug('more-top-stories')).toBe('congress')
    expect(politicsTopicArchiveSlug('politics-spotlight')).toBe('elections')
    expect(politicsTopicArchiveSlug('editorial-rail')).toBe('white-house')
    expect(politicsTopicArchiveSlug('politics-latest')).toBe('policy')
    expect(politicsTopicArchiveSlug('politics-courts')).toBe('courts')
    expect(politicsTopicArchiveSlug('custom-topic')).toBe('custom-topic')
  })
})

describe('politicsTopicCategorySlug', () => {
  it('uses the same friendly slug for tagged topic categories', () => {
    expect(politicsTopicCategorySlug('more-top-stories')).toBe('congress')
    expect(politicsTopicCategorySlug('politics-latest')).toBe('policy')
  })
})

describe('politicsArchiveCategorySlugs', () => {
  it('tries the dedicated topic before the parent politics pool', () => {
    expect(politicsArchiveCategorySlugs('more-top-stories')).toEqual([
      'congress',
      'politics',
    ])
    expect(politicsArchiveCategorySlugs('politics-latest')).toEqual([
      'policy',
      'politics',
    ])
  })
})

describe('archiveConnectionFromPoliticsArticles', () => {
  it('keeps slot stories so a topic archive is not empty', () => {
    const articles = [
      {
        id: 'a1',
        title: 'Congress briefing',
        slug: 'congress-briefing',
        summary: null,
        status: 'published' as const,
        authorName: 'Staff',
        thumbnailUrl: null,
        videoUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        publishedAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    const connection = archiveConnectionFromPoliticsArticles(articles, 1)
    expect(connection.total).toBe(1)
    expect(connection.items[0].title).toBe('Congress briefing')
  })
})

describe('politicsArchiveHref', () => {
  it('links topic headings only on the politics page', () => {
    expect(politicsArchiveHref('politics', 'more-top-stories')).toBe(
      '/politics/congress',
    )
    expect(politicsArchiveHref('politics', 'politics-latest')).toBe(
      '/politics/policy',
    )
    expect(politicsArchiveHref('politics', 'hero')).toBeNull()
    expect(politicsArchiveHref('health', 'politics-latest')).toBeNull()
    expect(politicsArchiveHref('homepage', 'politics')).toBeNull()
  })
})

describe('isPoliticsTopicArchiveSlot', () => {
  it('accepts topic rows and ignores hero, live, and ads', () => {
    expect(
      isPoliticsTopicArchiveSlot(slot('more-top-stories', 'editorial_lead')),
    ).toBe(true)
    expect(isPoliticsTopicArchiveSlot(slot('politics-latest', 'grid_4'))).toBe(
      true,
    )
    expect(isPoliticsTopicArchiveSlot(slot('hero', 'hero'))).toBe(false)
    expect(isPoliticsTopicArchiveSlot(slot('ad-ribbon', 'ribbon_ad'))).toBe(
      false,
    )
  })
})

describe('findPoliticsArchiveSlot', () => {
  it('matches friendly slugs and position keys, ignoring hero', () => {
    const slots = [
      slot('hero', 'hero'),
      slot('more-top-stories', 'editorial_lead'),
      slot('politics-latest', 'grid_4'),
    ]

    expect(findPoliticsArchiveSlot(slots, 'congress')?.id).toBe(
      'slot-more-top-stories',
    )
    expect(findPoliticsArchiveSlot(slots, 'more-top-stories')?.id).toBe(
      'slot-more-top-stories',
    )
    expect(findPoliticsArchiveSlot(slots, 'policy')?.id).toBe(
      'slot-politics-latest',
    )
    expect(findPoliticsArchiveSlot(slots, 'hero')).toBeUndefined()
  })
})
