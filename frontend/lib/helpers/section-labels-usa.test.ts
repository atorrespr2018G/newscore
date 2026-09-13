import { shouldOmitUsaHomepageSection } from '@/lib/helpers/section-labels'

describe('shouldOmitUsaHomepageSection', () => {
  it('omits the USA band on US homepages', () => {
    expect(shouldOmitUsaHomepageSection('us', 'homepage', 'us-featured')).toBe(true)
    expect(shouldOmitUsaHomepageSection('us', 'homepage', 'us')).toBe(true)
  })

  it('keeps the USA band on other markets and pages', () => {
    expect(shouldOmitUsaHomepageSection('pr', 'homepage', 'us-featured')).toBe(false)
    expect(shouldOmitUsaHomepageSection('us', 'world', 'us-featured')).toBe(false)
    expect(shouldOmitUsaHomepageSection('us', 'homepage', 'politics')).toBe(false)
  })
})
