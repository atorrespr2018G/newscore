import {
  articleSlugFromPath,
  clearHeroVideoAdPending,
  HERO_VIDEO_AD_SKIP_AFTER_MS,
  markHeroVideoAdPending,
  normalizeHeroVideoAdSlug,
  peekHeroVideoAdPending,
  remainingSkipSeconds,
  shouldShowHeroVideoAd,
  type IHeroVideoAdStorage,
} from '@/lib/helpers/hero-video-ad'

function createMemoryStorage(): IHeroVideoAdStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

describe('markHeroVideoAdPending', () => {
  it('stores a trimmed decoded slug', () => {
    const storage = createMemoryStorage()
    markHeroVideoAdPending('  water-crisis  ', storage)
    expect(peekHeroVideoAdPending(storage)).toBe('water-crisis')
  })

  it('throws when the slug is empty', () => {
    const storage = createMemoryStorage()
    expect(() => markHeroVideoAdPending('   ', storage)).toThrow(/non-empty/)
  })

  it('no-ops when storage is unavailable', () => {
    expect(() => markHeroVideoAdPending('water-crisis', null)).not.toThrow()
  })
})

describe('peekHeroVideoAdPending', () => {
  it('returns null when nothing is pending', () => {
    expect(peekHeroVideoAdPending(createMemoryStorage())).toBeNull()
  })

  it('does not clear the stored slug', () => {
    const storage = createMemoryStorage()
    markHeroVideoAdPending('water-crisis', storage)
    expect(peekHeroVideoAdPending(storage)).toBe('water-crisis')
    expect(peekHeroVideoAdPending(storage)).toBe('water-crisis')
  })
})

describe('clearHeroVideoAdPending', () => {
  it('removes the stored slug', () => {
    const storage = createMemoryStorage()
    markHeroVideoAdPending('water-crisis', storage)
    clearHeroVideoAdPending(storage)
    expect(peekHeroVideoAdPending(storage)).toBeNull()
  })
})

describe('normalizeHeroVideoAdSlug', () => {
  it('decodes URI-encoded slugs', () => {
    expect(normalizeHeroVideoAdSlug('edificios-colapsan%20venezuela')).toBe(
      'edificios-colapsan venezuela',
    )
  })
})

describe('articleSlugFromPath', () => {
  it('reads the article slug from a public article path', () => {
    expect(articleSlugFromPath('/article/edificios-colapsan')).toBe('edificios-colapsan')
    expect(articleSlugFromPath('/en/article/edificios-colapsan')).toBe('edificios-colapsan')
    expect(articleSlugFromPath('/')).toBeNull()
  })
})

describe('shouldShowHeroVideoAd', () => {
  it('shows when the pending slug matches and ads are on', () => {
    expect(
      shouldShowHeroVideoAd({
        pendingSlug: 'water-crisis',
        articleSlug: 'water-crisis',
        mode: 'mock',
      }),
    ).toBe(true)
    expect(
      shouldShowHeroVideoAd({
        pendingSlug: 'water-crisis',
        articleSlug: 'water-crisis',
        mode: 'gam',
      }),
    ).toBe(true)
  })

  it('matches encoded and decoded slugs', () => {
    expect(
      shouldShowHeroVideoAd({
        pendingSlug: 'edificios-colapsan',
        articleSlug: 'edificios-colapsan',
        mode: 'mock',
      }),
    ).toBe(true)
  })

  it('hides when ads are off, slugs differ, or nothing is pending', () => {
    expect(
      shouldShowHeroVideoAd({
        pendingSlug: 'water-crisis',
        articleSlug: 'water-crisis',
        mode: 'off',
      }),
    ).toBe(false)
    expect(
      shouldShowHeroVideoAd({
        pendingSlug: 'water-crisis',
        articleSlug: 'other-story',
        mode: 'mock',
      }),
    ).toBe(false)
    expect(
      shouldShowHeroVideoAd({
        pendingSlug: null,
        articleSlug: 'water-crisis',
        mode: 'mock',
      }),
    ).toBe(false)
  })
})

describe('remainingSkipSeconds', () => {
  it('counts down to zero at the skip threshold', () => {
    expect(remainingSkipSeconds(0, HERO_VIDEO_AD_SKIP_AFTER_MS)).toBe(5)
    expect(remainingSkipSeconds(1400, HERO_VIDEO_AD_SKIP_AFTER_MS)).toBe(4)
    expect(remainingSkipSeconds(HERO_VIDEO_AD_SKIP_AFTER_MS, HERO_VIDEO_AD_SKIP_AFTER_MS)).toBe(0)
    expect(remainingSkipSeconds(HERO_VIDEO_AD_SKIP_AFTER_MS + 800, HERO_VIDEO_AD_SKIP_AFTER_MS)).toBe(
      0,
    )
  })
})
