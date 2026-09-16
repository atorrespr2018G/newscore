import { describe, expect, it } from 'vitest'
import {
  WORLDWIDE_PLACEMENT_SLOT_OPTIONS,
  worldwideSlotMaxPosition,
} from '@/lib/helpers/worldwide-placement'

describe('worldwideSlotMaxPosition', () => {
  it('returns configured max for known slots', () => {
    expect(worldwideSlotMaxPosition('hero')).toBe(11)
    expect(worldwideSlotMaxPosition('more-top-stories')).toBe(6)
  })

  it('falls back for unknown slots', () => {
    expect(worldwideSlotMaxPosition('unknown')).toBe(11)
  })

  it('exposes hero and more top stories options', () => {
    expect(WORLDWIDE_PLACEMENT_SLOT_OPTIONS.map((o) => o.positionKey)).toEqual([
      'hero',
      'more-top-stories',
      'more-top-stories-2',
    ])
  })
})
