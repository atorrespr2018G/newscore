import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import {
  findSlotByPositionKey,
  isShiftDownPlacementPositionKey,
  splitDefaultHeroArticles,
} from '@/lib/helpers/feed-layout'

function article(id: string): IArticle {
  return {
    id,
    title: `Article ${id}`,
    slug: id,
    summary: null,
    status: 'published',
    authorName: 'Author',
    thumbnailUrl: null,
    videoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    publishedAt: '2026-01-01T00:00:00Z',
  }
}

describe('findSlotByPositionKey', () => {
  it('returns the slot matching a position key', () => {
    const slots: IFeedSlot[] = [
      { id: 'slot-1', positionKey: 'hero', presentationType: 'hero', articles: [] },
      { id: 'slot-2', positionKey: 'us-featured', presentationType: 'grid', articles: [] },
    ]

    expect(findSlotByPositionKey(slots, 'hero')?.id).toBe('slot-1')
  })
})

describe('isShiftDownPlacementPositionKey', () => {
  it('recognizes shift-down placement slots', () => {
    expect(isShiftDownPlacementPositionKey('hero')).toBe(true)
    expect(isShiftDownPlacementPositionKey('world')).toBe(false)
  })
})

describe('splitDefaultHeroArticles', () => {
  it('partitions hero articles into layout slices', () => {
    const articles = Array.from({ length: 12 }, (_, index) => article(`a-${index}`))
    const slices = splitDefaultHeroArticles(articles)

    expect(slices.left.map((item) => item.id)).toEqual(['a-1', 'a-2', 'a-3'])
    expect(slices.rightCards.map((item) => item.id)).toEqual(['a-10', 'a-11'])
  })
})
