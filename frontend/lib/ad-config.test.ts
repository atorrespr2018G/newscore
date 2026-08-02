import {
  AD_SLOT_REGISTRY,
  getSlotVariant,
  parseAdsMode,
  shouldServeMockAds,
} from '@/lib/ad-config'

describe('parseAdsMode', () => {
  it('defaults to mock when unset or invalid', () => {
    expect(parseAdsMode(undefined)).toBe('mock')
    expect(parseAdsMode('')).toBe('mock')
    expect(parseAdsMode('nope')).toBe('mock')
  })

  it('accepts known modes case-insensitively', () => {
    expect(parseAdsMode('mock')).toBe('mock')
    expect(parseAdsMode('OFF')).toBe('off')
    expect(parseAdsMode(' Gam ')).toBe('gam')
  })
})

describe('getSlotVariant', () => {
  it('returns the registry variant for each slot key', () => {
    expect(getSlotVariant('masthead-leaderboard')).toBe('leaderboard')
    expect(getSlotVariant('article-rail')).toBe('tall')
    expect(getSlotVariant('homepage-us-band')).toBe('square')
  })

  it('covers every registry entry', () => {
    for (const definition of Object.values(AD_SLOT_REGISTRY)) {
      expect(getSlotVariant(definition.key)).toBe(definition.variant)
    }
  })
})

describe('shouldServeMockAds', () => {
  it('is true only for mock mode', () => {
    expect(shouldServeMockAds('mock')).toBe(true)
    expect(shouldServeMockAds('off')).toBe(false)
    expect(shouldServeMockAds('gam')).toBe(false)
  })
})
