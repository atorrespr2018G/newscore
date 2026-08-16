import { describe, expect, it } from 'vitest'

import type { ICategoryOut } from '@/lib/api/category-client'
import {
  isBusinessBeatCategory,
  resolveBusinessSubcategories,
} from '@/lib/helpers/business-category-options'
import { rootSectionCategories } from '@/lib/helpers/sports-category-options'

function category(partial: Partial<ICategoryOut> & Pick<ICategoryOut, 'id' | 'slug'>): ICategoryOut {
  return {
    name: partial.name ?? partial.slug,
    parent_id: null,
    ...partial,
  }
}

describe('resolveBusinessSubcategories', () => {
  it('returns Economía beats under the business parent in archive order', () => {
    const parent = category({ id: 'biz', slug: 'business', name: 'Economy' })
    const autos = category({
      id: 'autos',
      slug: 'autos',
      name: 'Autos',
      parent_id: 'biz',
    })
    const economy = category({
      id: 'econ',
      slug: 'economy',
      name: 'Economy',
      parent_id: 'biz',
    })
    expect(resolveBusinessSubcategories([parent, autos, economy]).map((row) => row.slug)).toEqual([
      'economy',
      'autos',
    ])
  })
})

describe('rootSectionCategories', () => {
  it('keeps Economy and hides Economía beat rows', () => {
    const parent = category({ id: 'biz', slug: 'business', name: 'Economy' })
    const autos = category({
      id: 'autos',
      slug: 'autos',
      name: 'Autos',
      parent_id: null,
    })
    const roots = rootSectionCategories([parent, autos], [])
    expect(roots.map((row) => row.slug)).toEqual(['business'])
    expect(isBusinessBeatCategory([parent, autos], autos)).toBe(true)
  })
})
