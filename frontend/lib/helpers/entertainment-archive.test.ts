import { describe, expect, it } from 'vitest'

import {
  entertainmentArchiveHref,
  findEntertainmentArchiveSlot,
} from '@/lib/helpers/entertainment-archive'
import type { IFeedSlot } from '@/interfaces/feed'
import {
  entertainmentPagePath,
  homepageSectionLandingHref,
  isSectionPageActive,
  sectionKeyFromPathname,
} from '@/lib/helpers/section-labels'

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

describe('entertainmentPagePath', () => {
  it('builds a lowercase entertainment archive path', () => {
    expect(entertainmentPagePath('Music')).toBe('/entertainment/music')
    expect(entertainmentPagePath('arts-culture')).toBe('/entertainment/arts-culture')
  })
})

describe('entertainmentArchiveHref', () => {
  it('links compact rows on the entertainment page', () => {
    expect(entertainmentArchiveHref('entertainment', 'music')).toBe('/entertainment/music')
  })

  it('does not link homepage compact rows', () => {
    expect(entertainmentArchiveHref('homepage', 'music')).toBeNull()
  })
})

describe('findEntertainmentArchiveSlot', () => {
  it('matches a compact topic slug', () => {
    const found = findEntertainmentArchiveSlot(
      [slot('hero', 'hero'), slot('music')],
      'music',
    )
    expect(found?.positionKey).toBe('music')
  })

  it('does not match the hero slot', () => {
    expect(findEntertainmentArchiveSlot([slot('hero', 'hero')], 'hero')).toBeUndefined()
  })
})

describe('entertainment section routes', () => {
  it('treats Entertainment archives as the entertainment section page', () => {
    expect(sectionKeyFromPathname('/entertainment')).toBe('entertainment')
    expect(sectionKeyFromPathname('/entertainment/music')).toBe('entertainment')
    expect(isSectionPageActive('/entertainment/music', 'entertainment')).toBe(true)
  })

  it('opens the Entertainment landing from the homepage heading', () => {
    expect(homepageSectionLandingHref('homepage', 'entertainment')).toBe('/entertainment')
  })
})
