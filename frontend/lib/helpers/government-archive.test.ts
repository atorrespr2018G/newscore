import { describe, expect, it } from 'vitest'

import { governmentArchiveHref, findGovernmentArchiveSlot } from '@/lib/helpers/government-archive'
import type { IFeedSlot } from '@/interfaces/feed'
import {
  governmentPagePath,
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

describe('governmentPagePath', () => {
  it('builds a lowercase government archive path', () => {
    expect(governmentPagePath('Executive')).toBe('/government/executive')
  })
})

describe('governmentArchiveHref', () => {
  it('links compact rows on the government page', () => {
    expect(governmentArchiveHref('government', 'executive')).toBe('/government/executive')
  })

  it('does not link homepage compact rows', () => {
    expect(governmentArchiveHref('homepage', 'executive')).toBeNull()
  })
})

describe('findGovernmentArchiveSlot', () => {
  it('matches a compact topic slug', () => {
    const found = findGovernmentArchiveSlot(
      [slot('hero', 'hero'), slot('executive')],
      'executive',
    )
    expect(found?.positionKey).toBe('executive')
  })

  it('does not match the hero slot', () => {
    expect(findGovernmentArchiveSlot([slot('hero', 'hero')], 'hero')).toBeUndefined()
  })
})

describe('government section routes', () => {
  it('treats Government archives as the government section page', () => {
    expect(sectionKeyFromPathname('/government')).toBe('government')
    expect(sectionKeyFromPathname('/government/executive')).toBe('government')
    expect(isSectionPageActive('/government/executive', 'government')).toBe(true)
  })
})
