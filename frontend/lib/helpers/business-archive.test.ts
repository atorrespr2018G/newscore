import { describe, expect, it } from 'vitest'

import { businessArchiveHref, findBusinessArchiveSlot } from '@/lib/helpers/business-archive'
import type { IFeedSlot } from '@/interfaces/feed'
import { isSectionPageActive, sectionKeyFromPathname } from '@/lib/helpers/section-labels'

function slot(positionKey: string, presentationType = 'grid_4'): IFeedSlot {
  return {
    id: positionKey,
    positionKey,
    displayName: positionKey,
    presentationType,
    contentType: 'article',
    articles: [],
  }
}

describe('businessArchiveHref', () => {
  it('links compact rows on the business page', () => {
    expect(businessArchiveHref('business', 'autos')).toBe('/business/autos')
  })

  it('does not link homepage compact rows', () => {
    expect(businessArchiveHref('homepage', 'autos')).toBeNull()
  })
})

describe('findBusinessArchiveSlot', () => {
  it('matches a compact beat slug', () => {
    const found = findBusinessArchiveSlot(
      [slot('hero', 'hero'), slot('autos')],
      'autos',
    )
    expect(found?.positionKey).toBe('autos')
  })

  it('does not match the hero slot', () => {
    expect(findBusinessArchiveSlot([slot('hero', 'hero')], 'hero')).toBeUndefined()
  })
})

describe('business section routes', () => {
  it('treats Economía archives as the business section page', () => {
    expect(sectionKeyFromPathname('/business')).toBe('business')
    expect(sectionKeyFromPathname('/business/autos')).toBe('business')
    expect(isSectionPageActive('/business/autos', 'business')).toBe(true)
  })
})
