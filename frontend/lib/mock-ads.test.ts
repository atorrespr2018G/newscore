import {
  hashAdPlacement,
  MOCK_AD_LATENCY_MS,
  MOCK_CREATIVE_CATALOG,
  selectMockCreative,
} from '@/lib/mock-ads'

describe('mock ad latency', () => {
  it('uses a short simulated network delay', () => {
    expect(MOCK_AD_LATENCY_MS).toBeGreaterThanOrEqual(250)
    expect(MOCK_AD_LATENCY_MS).toBeLessThanOrEqual(400)
  })
})

describe('hashAdPlacement', () => {
  it('is stable for the same placement', () => {
    expect(hashAdPlacement('article-rail', 1)).toBe(hashAdPlacement('article-rail', 1))
  })

  it('changes when the index changes', () => {
    expect(hashAdPlacement('article-rail', 0)).not.toBe(hashAdPlacement('article-rail', 1))
  })
})

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
