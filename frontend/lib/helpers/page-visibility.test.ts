import { describe, expect, it } from 'vitest'
import {
  isLandingDisabled,
  isPublicPageEnabled,
  omitDisabledLandingSlots,
} from '@/lib/helpers/page-visibility'
import type { IFeedSlot } from '@/interfaces/feed'

function slot(positionKey: string): IFeedSlot {
  return {
    id: positionKey,
    positionKey,
    displayName: positionKey,
    presentationType: 'grid_4',
    contentType: 'article',
    articles: [],
  }
}

describe('isPublicPageEnabled', () => {
  it('keeps the homepage on even if isEnabled is false', () => {
    expect(isPublicPageEnabled({ pageName: 'homepage', isEnabled: false })).toBe(true)
  })

  it('treats missing isEnabled as on', () => {
    expect(isPublicPageEnabled({ pageName: 'sports' })).toBe(true)
  })

  it('hides a disabled landing', () => {
    expect(isPublicPageEnabled({ pageName: 'sports', isEnabled: false })).toBe(false)
  })
})

describe('isLandingDisabled', () => {
  it('maps finance nav to the health landing', () => {
    expect(isLandingDisabled('finance', ['health'])).toBe(true)
    expect(isLandingDisabled('health', ['health'])).toBe(true)
    expect(isLandingDisabled('sports', ['health'])).toBe(false)
  })
})

describe('omitDisabledLandingSlots', () => {
  it('drops homepage bands whose landing is disabled', () => {
    const slots = omitDisabledLandingSlots(
      [slot('sports'), slot('world'), slot('politics')],
      ['sports'],
      'homepage',
    )
    expect(slots.map((row) => row.positionKey)).toEqual(['world', 'politics'])
  })

  it('leaves sports-page rows unchanged', () => {
    const slots = omitDisabledLandingSlots([slot('baseball')], ['sports'], 'sports')
    expect(slots).toHaveLength(1)
  })
})
