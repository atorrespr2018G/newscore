import {
  EMPTY_EDITOR_SEARCH_FILTERS,
  hasActiveSearchFilters,
  htmlTextLength,
  mergeArticlePages,
  moveItem,
} from '@/lib/helpers/editor-curation'

describe('hasActiveSearchFilters', () => {
  it('returns false for an empty filter set', () => {
    expect(hasActiveSearchFilters(EMPTY_EDITOR_SEARCH_FILTERS)).toBe(false)
  })

  it('returns true when any filter has a trimmed value', () => {
    expect(
      hasActiveSearchFilters({
        ...EMPTY_EDITOR_SEARCH_FILTERS,
        title: '  bridge  ',
      }),
    ).toBe(true)
  })
})

describe('mergeArticlePages', () => {
  it('deduplicates rows by id while preserving order', () => {
    const current = [{ id: 'a', title: 'A' } as const]
    const incoming = [
      { id: 'a', title: 'A duplicate' } as const,
      { id: 'b', title: 'B' } as const,
    ]

    const merged = mergeArticlePages(current as never, incoming as never)

    expect(merged.map((row) => row.id)).toEqual(['a', 'b'])
    expect(merged[0].title).toBe('A')
  })
})

describe('moveItem', () => {
  it('moves an item to a new index', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })
})

describe('htmlTextLength', () => {
  it('strips markup during SSR', () => {
    expect(htmlTextLength('<p>Hello <strong>world</strong></p>')).toBe(11)
  })
})
