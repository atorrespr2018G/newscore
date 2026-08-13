import {
  EDITOR_AD_LOCATIONS,
  STACKING_AD_LOCATIONS,
  findAdPlacement,
  isAdEnabled,
  mapPageAdPlacement,
  resolveAdVariant,
  shouldRenderConfiguredAd,
  type IPageAdPlacement,
} from '@/lib/helpers/page-ad-placements'

function placement(
  partial: Partial<IPageAdPlacement> & Pick<IPageAdPlacement, 'location'>,
): IPageAdPlacement {
  return {
    adType: partial.adType ?? 'ribbon',
    location: partial.location,
    enabled: partial.enabled ?? true,
    anchorSlug: partial.anchorSlug ?? null,
  }
}

describe('mapPageAdPlacement', () => {
  it('maps snake_case and camelCase rows', () => {
    expect(
      mapPageAdPlacement({
        ad_type: 'Leaderboard',
        location: 'masthead',
        enabled: true,
      }),
    ).toEqual({
      adType: 'leaderboard',
      location: 'masthead',
      enabled: true,
      anchorSlug: null,
    })
    expect(
      mapPageAdPlacement({
        adType: 'ribbon',
        location: 'before_section',
        enabled: false,
        anchorSlug: 'Politics',
      }),
    ).toEqual({
      adType: 'ribbon',
      location: 'before_section',
      enabled: false,
      anchorSlug: 'politics',
    })
  })

  it('returns null for invalid types', () => {
    expect(mapPageAdPlacement({ ad_type: 'banner', location: 'masthead' })).toBeNull()
  })
})

describe('shouldRenderConfiguredAd', () => {
  it('keeps legacy always-on behavior when placements are empty', () => {
    expect(shouldRenderConfiguredAd([], 'masthead')).toBe(true)
    expect(shouldRenderConfiguredAd(undefined, 'after_hero')).toBe(true)
  })

  it('gates on enabled matching placements', () => {
    const placements = [
      placement({ location: 'masthead', adType: 'leaderboard', enabled: false }),
      placement({ location: 'after_hero', adType: 'ribbon', enabled: true }),
    ]
    expect(shouldRenderConfiguredAd(placements, 'masthead')).toBe(false)
    expect(shouldRenderConfiguredAd(placements, 'after_hero')).toBe(true)
    expect(shouldRenderConfiguredAd(placements, 'us_band')).toBe(false)
  })

  it('matches section anchors for before/after section locations', () => {
    const placements = [
      placement({ location: 'before_section', anchorSlug: 'politics' }),
      placement({ location: 'after_section', anchorSlug: 'africa', enabled: false }),
    ]
    expect(isAdEnabled(placements, 'before_section', 'Politics')).toBe(true)
    expect(isAdEnabled(placements, 'before_section', 'world')).toBe(false)
    expect(shouldRenderConfiguredAd(placements, 'after_section', 'africa')).toBe(false)
  })
})

describe('findAdPlacement and resolveAdVariant', () => {
  it('returns the first enabled match and its ad type', () => {
    const placements = [
      placement({ location: 'editorial_band', adType: 'tall', enabled: false }),
      placement({ location: 'editorial_band', adType: 'ribbon' }),
    ]
    const match = findAdPlacement(placements, 'editorial_band')
    expect(match?.adType).toBe('ribbon')
    expect(resolveAdVariant(match, 'square')).toBe('ribbon')
    expect(resolveAdVariant(null, 'square')).toBe('square')
  })
})

describe('EDITOR_AD_LOCATIONS', () => {
  it('excludes stacking in-feed ribbon locations', () => {
    expect(STACKING_AD_LOCATIONS.has('after_hero')).toBe(true)
    expect(STACKING_AD_LOCATIONS.has('before_section')).toBe(true)
    expect(STACKING_AD_LOCATIONS.has('after_section')).toBe(true)
    for (const location of EDITOR_AD_LOCATIONS) {
      expect(STACKING_AD_LOCATIONS.has(location)).toBe(false)
    }
  })
})
