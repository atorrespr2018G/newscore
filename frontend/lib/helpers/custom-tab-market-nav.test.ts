import { describe, expect, it } from 'vitest'

import {
  firstPathSegment,
  isPossibleCustomTabPath,
} from '@/lib/helpers/custom-tab-market-nav'

describe('custom-tab-market-nav', () => {
  it('reads the first path segment', () => {
    expect(firstPathSegment('/')).toBeNull()
    expect(firstPathSegment('/test')).toBe('test')
    expect(firstPathSegment('/test/topic')).toBe('test')
  })

  it('treats built-in pages as non-custom', () => {
    expect(isPossibleCustomTabPath('/entertainment')).toBe(false)
    expect(isPossibleCustomTabPath('/health/fitness')).toBe(false)
    expect(isPossibleCustomTabPath('/test')).toBe(true)
  })
})
