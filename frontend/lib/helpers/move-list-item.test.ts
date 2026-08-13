import { moveListItem } from '@/lib/helpers/move-list-item'

describe('moveListItem', () => {
  it('moves an item forward and backward', () => {
    expect(moveListItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveListItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('returns the same list for invalid indexes', () => {
    const items = ['a', 'b']
    expect(moveListItem(items, 1, 1)).toBe(items)
    expect(moveListItem(items, -1, 0)).toBe(items)
    expect(moveListItem(items, 0, 5)).toBe(items)
  })
})
