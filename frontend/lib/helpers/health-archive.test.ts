import { describe, expect, it } from 'vitest'

import {
  healthArchiveHref,
  findHealthArchiveSlot,
} from '@/lib/helpers/health-archive'
import type { IFeedSlot } from '@/interfaces/feed'
import {
  healthPagePath,
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

describe('healthPagePath', () => {
  it('builds a lowercase health archive path', () => {
    expect(healthPagePath('Fitness')).toBe('/health/fitness')
    expect(healthPagePath('food')).toBe('/health/food')
  })
})

describe('healthArchiveHref', () => {
  it('links compact rows on the health page', () => {
    expect(healthArchiveHref('health', 'fitness')).toBe('/health/fitness')
  })

  it('does not link homepage compact rows', () => {
    expect(healthArchiveHref('homepage', 'fitness')).toBeNull()
  })
})

describe('findHealthArchiveSlot', () => {
  it('matches a compact topic slug', () => {
    const found = findHealthArchiveSlot(
      [slot('hero', 'hero'), slot('fitness')],
      'fitness',
    )
    expect(found?.positionKey).toBe('fitness')
  })

  it('does not match the hero slot', () => {
    expect(findHealthArchiveSlot([slot('hero', 'hero')], 'hero')).toBeUndefined()
  })
})

describe('health section routes', () => {
  it('maps Health archives to the finance homepage section key', () => {
    expect(sectionKeyFromPathname('/health')).toBe('finance')
    expect(sectionKeyFromPathname('/health/fitness')).toBe('finance')
    expect(isSectionPageActive('/health/fitness', 'finance')).toBe(true)
  })

  it('opens the Health landing from the homepage Health heading', () => {
    expect(homepageSectionLandingHref('homepage', 'finance')).toBe('/health')
  })
})
