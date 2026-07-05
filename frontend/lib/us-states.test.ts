import { describe, expect, it } from 'vitest'

import {
  isValidUsStateCode,
  US_STATE_COUNT,
  US_STATE_OPTIONS,
  usStateLabel,
} from '@/lib/us-states'

describe('us-states', () => {
  it('validates configured state codes', () => {
    expect(isValidUsStateCode('ca')).toBe(true)
    expect(isValidUsStateCode('ny')).toBe(true)
    expect(isValidUsStateCode('invalid')).toBe(false)
  })

  it('resolves state labels', () => {
    expect(usStateLabel('tx')).toBe('Texas')
    expect(usStateLabel('unknown')).toBe('unknown')
  })

  it('includes all US states for the masthead locality picker', () => {
    expect(US_STATE_OPTIONS).toHaveLength(US_STATE_COUNT)
  })
})
