'use client'

import { useTranslations } from 'next-intl'

import type { IPageAdPlacementApi } from '@/lib/api/layout-client'
import type { PageAdLocation, PageAdType } from '@/lib/helpers/page-ad-placements'

const SELECT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm'
const AD_TYPES: PageAdType[] = ['leaderboard', 'ribbon', 'rail', 'tall', 'square']
const AD_LOCATIONS: PageAdLocation[] = [
  'masthead',
  'after_hero',
  'before_section',
  'after_section',
  'hero_rail',
  'us_band',
  'editorial_band',
  'health_carousel',
]
const ANCHOR_LOCATIONS = new Set<PageAdLocation>(['before_section', 'after_section'])

export interface IEditableAdRow {
  key: string
  adType: PageAdType
  location: PageAdLocation
  enabled: boolean
  anchorSlug: string
}

/**
 * Map API ad rows into editable local rows.
 *
 * @param ads - Saved page ad placements.
 * @returns Editable ad rows with stable keys.
 */
export function toEditableAdRows(ads: IPageAdPlacementApi[] | undefined): IEditableAdRow[] {
  return (ads ?? []).map((ad, index) => ({
    key: `${ad.location}-${ad.anchor_slug ?? 'none'}-${index}`,
    adType: ad.ad_type,
    location: ad.location,
    enabled: ad.enabled !== false,
    anchorSlug: ad.anchor_slug ?? '',
  }))
}

/**
 * Map editable ad rows to the API payload shape.
 *
 * @param rows - Local editor rows.
 * @returns API ad placement list.
 */
export function toApiAdRows(rows: IEditableAdRow[]): IPageAdPlacementApi[] {
  return rows.map((row) => ({
    ad_type: row.adType,
    location: row.location,
    enabled: row.enabled,
    anchor_slug: ANCHOR_LOCATIONS.has(row.location) ? row.anchorSlug.trim() || null : null,
  }))
}

interface IPageAdsEditorProps {
  rows: IEditableAdRow[]
  sectionSlugs: string[]
  onChange: (rows: IEditableAdRow[]) => void
}

/**
 * Configuration editor for page-level ad type and location list.
 */
export function PageAdsEditor({ rows, sectionSlugs, onChange }: IPageAdsEditorProps): JSX.Element {
  const t = useTranslations('admin.pageAds')

  function updateRow(index: number, patch: Partial<IEditableAdRow>): void {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function moveRow(index: number, delta: number): void {
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= rows.length) {
      return
    }
    const next = [...rows]
    const [removed] = next.splice(index, 1)
    next.splice(nextIndex, 0, removed)
    onChange(next)
  }

  function addRow(): void {
    onChange([
      ...rows,
      {
        key: `new-${Date.now()}`,
        adType: 'ribbon',
        location: 'after_hero',
        enabled: true,
        anchorSlug: sectionSlugs[0] ?? '',
      },
    ])
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{t('heading')}</h3>
        <p className="mt-1 text-xs text-neutral-600">{t('hint')}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="grid gap-3 rounded border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto_auto]"
            >
              <label className="block text-xs font-medium text-neutral-700">
                {t('type')}
                <select
                  className={SELECT_CLASS}
                  value={row.adType}
                  onChange={(event) => updateRow(index, { adType: event.target.value as PageAdType })}
                >
                  {AD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-neutral-700">
                {t('location')}
                <select
                  className={SELECT_CLASS}
                  value={row.location}
                  onChange={(event) =>
                    updateRow(index, { location: event.target.value as PageAdLocation })
                  }
                >
                  {AD_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {t(`locations.${location}`)}
                    </option>
                  ))}
                </select>
              </label>

              {ANCHOR_LOCATIONS.has(row.location) ? (
                <label className="block text-xs font-medium text-neutral-700 md:col-span-2">
                  {t('anchor')}
                  <select
                    className={SELECT_CLASS}
                    value={row.anchorSlug}
                    onChange={(event) => updateRow(index, { anchorSlug: event.target.value })}
                  >
                    <option value="">{t('anchorPlaceholder')}</option>
                    {sectionSlugs.map((slug) => (
                      <option key={slug} value={slug}>
                        {slug}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                />
                {t('enabled')}
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  onClick={() => moveRow(index, -1)}
                  disabled={index === 0}
                >
                  {t('moveUp')}
                </button>
                <button
                  type="button"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  onClick={() => moveRow(index, 1)}
                  disabled={index === rows.length - 1}
                >
                  {t('moveDown')}
                </button>
                <button
                  type="button"
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                  onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                >
                  {t('remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addRow}
        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium"
      >
        {t('add')}
      </button>
    </div>
  )
}
