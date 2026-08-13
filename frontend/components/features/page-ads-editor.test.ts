import { toApiAdRows, toEditableAdRows } from '@/components/features/page-ads-editor'
import type { IPageAdPlacementApi } from '@/lib/api/layout-client'

describe('toEditableAdRows', () => {
  it('omits stacking in-feed ribbon placements', () => {
    const ads: IPageAdPlacementApi[] = [
      { ad_type: 'leaderboard', location: 'masthead', enabled: true, anchor_slug: null },
      { ad_type: 'ribbon', location: 'after_hero', enabled: true, anchor_slug: null },
      {
        ad_type: 'ribbon',
        location: 'before_section',
        enabled: true,
        anchor_slug: 'politics',
      },
      { ad_type: 'square', location: 'us_band', enabled: true, anchor_slug: null },
    ]

    const rows = toEditableAdRows(ads)

    expect(rows.map((row) => row.location)).toEqual(['masthead', 'us_band'])
  })
})

describe('toApiAdRows', () => {
  it('sends in-module placements without section anchors', () => {
    const payload = toApiAdRows([
      {
        key: 'masthead-0',
        adType: 'leaderboard',
        location: 'masthead',
        enabled: true,
      },
    ])

    expect(payload).toEqual([
      {
        ad_type: 'leaderboard',
        location: 'masthead',
        enabled: true,
        anchor_slug: null,
      },
    ])
  })
})
