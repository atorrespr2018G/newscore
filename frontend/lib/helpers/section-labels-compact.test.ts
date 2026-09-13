import {
  isCompactSixBandPositionKey,
  isHomepageSectionVisible,
  homepageSectionLandingHref,
  sectionNavHref,
} from '@/lib/helpers/section-labels'

describe('homepage Style and Travel compact bands', () => {
  it('uses the six-card carousel like Business and Technology', () => {
    expect(isCompactSixBandPositionKey('business')).toBe(true)
    expect(isCompactSixBandPositionKey('technology')).toBe(true)
    expect(isCompactSixBandPositionKey('style')).toBe(true)
    expect(isCompactSixBandPositionKey('travel')).toBe(true)
  })

  it('shows Style and Travel in homepage navigation', () => {
    expect(isHomepageSectionVisible('style')).toBe(true)
    expect(isHomepageSectionVisible('travel')).toBe(true)
    expect(isHomepageSectionVisible('us-featured')).toBe(false)
  })

  it('opens Style and Travel landings from homepage headings', () => {
    expect(homepageSectionLandingHref('homepage', 'style')).toBe('/style')
    expect(homepageSectionLandingHref('homepage', 'travel')).toBe('/travel')
    expect(sectionNavHref('style')).toBe('/style')
    expect(sectionNavHref('travel')).toBe('/travel')
  })
})
