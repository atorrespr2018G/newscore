import type { IFeedSlot } from '@/interfaces/feed'
import { shouldRenderHomepageGridAd } from '@/lib/helpers/homepage-ad-placement'

function slot(positionKey: string): IFeedSlot {
  return {
    id: positionKey,
    positionKey,
    presentationType: 'grid',
    articles: [],
  }
}

describe('shouldRenderHomepageGridAd', () => {
  it('always inserts before politics', () => {
    expect(shouldRenderHomepageGridAd(undefined, slot('politics'))).toBe(true)
    expect(shouldRenderHomepageGridAd(slot('technology'), slot('politics'))).toBe(true)
  })

  it('inserts on configured section transitions', () => {
    expect(shouldRenderHomepageGridAd(slot('politics'), slot('world'))).toBe(true)
    expect(shouldRenderHomepageGridAd(slot('world'), slot('technology'))).toBe(true)
    expect(shouldRenderHomepageGridAd(slot('world'), slot('politics'))).toBe(true)
  })

  it('skips unrelated transitions', () => {
    expect(shouldRenderHomepageGridAd(slot('technology'), slot('world'))).toBe(false)
    expect(shouldRenderHomepageGridAd(slot('sports'), slot('health'))).toBe(false)
  })
})
