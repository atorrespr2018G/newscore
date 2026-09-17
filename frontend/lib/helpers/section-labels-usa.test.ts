import { shouldOmitUsaHomepageSection } from '@/lib/helpers/section-labels'

describe('shouldOmitUsaHomepageSection', () => {
  it('omits only the trailing US category on US homepages', () => {
    expect(shouldOmitUsaHomepageSection('us', 'homepage', 'us')).toBe(true)
    expect(shouldOmitUsaHomepageSection('us', 'homepage', 'us-featured')).toBe(false)
  })

  it('keeps Top Stories and US category on other markets and pages', () => {
    expect(shouldOmitUsaHomepageSection('pr', 'homepage', 'us-featured')).toBe(false)
    expect(shouldOmitUsaHomepageSection('us', 'world', 'us-featured')).toBe(false)
    expect(shouldOmitUsaHomepageSection('us', 'homepage', 'politics')).toBe(false)
  })
})
