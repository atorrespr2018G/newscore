import {
  isSectionPageActive,
  sectionKeyFromPathname,
  sectionNavHref,
  homepageSectionLandingHref,
} from '@/lib/helpers/section-labels'
import { totalPagesFor } from '@/lib/helpers/pagination'
import {
  isTechnologyArchivePositionKey,
  parseTechnologyArchivePage,
  TECHNOLOGY_ARCHIVE_PAGE_SIZE,
  TECHNOLOGY_ARCHIVE_PIN_LIMIT,
  TECHNOLOGY_PAGE_NAME,
  TECHNOLOGY_PAGE_PATH,
} from '@/lib/helpers/technology-archive'

describe('technology archive helpers', () => {
  it('uses a sixteen-story page size and a placement pin capacity above one page', () => {
    expect(TECHNOLOGY_ARCHIVE_PAGE_SIZE).toBe(16)
    expect(TECHNOLOGY_ARCHIVE_PIN_LIMIT).toBe(48)
    expect(totalPagesFor(16, TECHNOLOGY_ARCHIVE_PAGE_SIZE)).toBe(1)
    expect(totalPagesFor(17, TECHNOLOGY_ARCHIVE_PAGE_SIZE)).toBe(2)
  })

  it('parses archive pages the same way sport archives do', () => {
    expect(parseTechnologyArchivePage(undefined)).toBe(1)
    expect(parseTechnologyArchivePage('2')).toBe(2)
    expect(parseTechnologyArchivePage('0')).toBe(1)
  })

  it('recognizes the archive slot key', () => {
    expect(isTechnologyArchivePositionKey('archive')).toBe(true)
    expect(isTechnologyArchivePositionKey('Archive')).toBe(true)
    expect(isTechnologyArchivePositionKey('hero')).toBe(false)
  })
})

describe('technology section routing', () => {
  it('treats /technology as a dedicated section page', () => {
    expect(sectionKeyFromPathname('/technology')).toBe(TECHNOLOGY_PAGE_NAME)
    expect(isSectionPageActive('/technology', 'technology')).toBe(true)
    expect(isSectionPageActive('/sports', 'technology')).toBe(false)
    expect(sectionNavHref('technology')).toBe(TECHNOLOGY_PAGE_PATH)
  })

  it('opens Technology from the homepage heading', () => {
    expect(homepageSectionLandingHref('homepage', 'technology')).toBe(TECHNOLOGY_PAGE_PATH)
    expect(homepageSectionLandingHref('technology', 'archive')).toBeNull()
  })
})
