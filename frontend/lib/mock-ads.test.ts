import { MOCK_CREATIVE_CATALOG, selectMockCreative } from '@/lib/mock-ads'

describe('selectMockCreative', () => {
  it('returns a catalog entry for a slot placement', () => {
    const creative = selectMockCreative('homepage-section-ribbon', 0)
    expect(MOCK_CREATIVE_CATALOG.map((entry) => entry.id)).toContain(creative.id)
    expect(creative.accentClass.length).toBeGreaterThan(0)
  })

  it('is deterministic for the same slot and index', () => {
    const first = selectMockCreative('article-in-content', 2)
    const second = selectMockCreative('article-in-content', 2)
    expect(first).toEqual(second)
  })

  it('varies creatives across indices on the same slot', () => {
    const creatives = [0, 1, 2, 3, 4, 5].map((index) =>
      selectMockCreative('homepage-section-ribbon', index),
    )
    const uniqueIds = new Set(creatives.map((creative) => creative.id))
    expect(uniqueIds.size).toBeGreaterThan(1)
  })
})
