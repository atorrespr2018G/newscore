import { describe, expect, it } from 'vitest'
import {
  articleRegionToken,
  isCrossCountryPlacement,
  looksLikeRegionCode,
  scopeFromRegionCode,
} from '@/lib/helpers/editor-region-scope'

describe('scopeFromRegionCode', () => {
  it('resolves US state and Florida county codes', () => {
    expect(scopeFromRegionCode('us-fl-miami-dade')).toEqual({
      marketCode: 'us',
      townId: 'fl',
      countyId: 'miami-dade',
    })
  })

  it('resolves Puerto Rico town codes', () => {
    expect(scopeFromRegionCode('pr-vieques')).toEqual({
      marketCode: 'pr',
      townId: 'vieques',
      countyId: null,
    })
  })
})

describe('articleRegionToken', () => {
  it('prefers primary, then direct, then effective region ids', () => {
    expect(
      articleRegionToken({
        primary_region_id: null,
        direct_region_ids: ['pr-vieques'],
        effective_region_ids: ['pr'],
      }),
    ).toBe('pr-vieques')
  })
})

describe('isCrossCountryPlacement', () => {
  it('flags PR story on a US board', () => {
    expect(isCrossCountryPlacement('pr', 'us')).toBe(true)
  })

  it('allows same-country placement', () => {
    expect(isCrossCountryPlacement('us', 'us')).toBe(false)
  })

  it('does not block when article market is unknown', () => {
    expect(isCrossCountryPlacement(null, 'us')).toBe(false)
  })
})

describe('looksLikeRegionCode', () => {
  it('accepts canonical market-prefixed codes', () => {
    expect(looksLikeRegionCode('pr-vieques')).toBe(true)
    expect(looksLikeRegionCode('us-fl-miami-dade')).toBe(true)
  })

  it('rejects opaque mongo-style ids', () => {
    expect(looksLikeRegionCode('507f1f77bcf86cd799439011')).toBe(false)
  })
})
