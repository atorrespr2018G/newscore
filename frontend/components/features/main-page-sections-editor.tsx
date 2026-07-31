'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import {
  getMainPageSections,
  putMainPageSections,
  type IMainPageSectionItem,
  type MainPageSectionType,
} from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS } from '@/lib/editor/editor-scope'
import {
  FLORIDA_COUNTY_OPTIONS,
  FLORIDA_STATE_CODE,
} from '@/lib/florida-counties'
import { PUERTO_RICO_MARKET_CODE, PUERTO_RICO_TOWN_OPTIONS } from '@/lib/puerto-rico-towns'
import { toRegionCode } from '@/lib/region-code'
import { US_MARKET_CODE, US_STATE_OPTIONS } from '@/lib/us-states'

const SELECT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm capitalize'
const INPUT_CLASS =
  'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm'
const DEFAULT_US_STATE_CODE = 'fl'

const SECTION_TYPES: MainPageSectionType[] = [
  'hero',
  'top_stories',
  'live',
  'more_top_stories',
  'spotlight',
  'rail',
  'category',
]

const DEFAULT_LABEL_BY_TYPE: Record<MainPageSectionType, string> = {
  hero: 'Hero',
  top_stories: 'Top Stories',
  live: 'Live',
  more_top_stories: 'More Top Stories',
  spotlight: 'Government',
  rail: 'Sports',
  category: '',
}

const CANONICAL_SLUG_BY_TYPE: Partial<Record<MainPageSectionType, string>> = {
  hero: 'hero',
  top_stories: 'us-featured',
  live: 'health',
}

interface IEditableSectionRow {
  key: string
  sectionType: MainPageSectionType
  label: string
  slug: string
}

/**
 * Build local editable rows from API items.
 *
 * @param items Saved main-page section items.
 * @returns Editable row models with stable keys.
 */
function toEditableRows(items: IMainPageSectionItem[]): IEditableSectionRow[] {
  return items.map((item, index) => ({
    key: `${item.slug}-${index}`,
    sectionType: item.section_type,
    label: item.label,
    slug: item.slug,
  }))
}

/**
 * Region code for main-page section scope (country, state, county, or town).
 *
 * Must match Placement's `editorScopeRegionCode`: USA with no state is `us`,
 * not a market-level null board that Placement never reads.
 *
 * @param marketCode Selected market code.
 * @param localityId US state or PR town short code.
 * @param countyId Optional Florida county slug.
 * @returns Region code such as `us`, `us-fl`, or `pr-san-juan`.
 */
function mainPageSectionsRegionCode(
  marketCode: string,
  localityId: string | null,
  countyId: string | null,
): string {
  return toRegionCode(marketCode, localityId, countyId)
}

/**
 * Admin editor for the ordered main landing page section list of one geo scope.
 *
 * @returns Main-page sections administration UI.
 */
export function MainPageSectionsEditor(): JSX.Element {
  const t = useTranslations('admin')
  const tNav = useTranslations('navigation')
  const { pushToast } = useToast()
  const [marketCode, setMarketCode] = useState('pr')
  const [localityId, setLocalityId] = useState<string | null>(null)
  const [countyId, setCountyId] = useState<string | null>(null)
  const [rows, setRows] = useState<IEditableSectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const showLocality = marketCode === US_MARKET_CODE || marketCode === PUERTO_RICO_MARKET_CODE
  const showFloridaCounty = marketCode === US_MARKET_CODE && localityId === FLORIDA_STATE_CODE
  const regionCode = mainPageSectionsRegionCode(marketCode, localityId, countyId)

  useEffect(() => {
    let cancelled = false

    async function loadSections(): Promise<void> {
      setLoading(true)
      try {
        const data = await getMainPageSections(marketCode, regionCode)
        if (!cancelled) {
          setRows(toEditableRows(data.items))
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : t('mainPage.loadFailed')
          pushToast(message, 'error')
          setRows([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSections()
    return () => {
      cancelled = true
    }
  }, [marketCode, regionCode, pushToast, t])

  /**
   * Persist the current ordered list for the selected market or locality.
   */
  async function handleSave(): Promise<void> {
    const items = rows
      .map((row) => ({
        section_type: row.sectionType,
        label: row.label.trim(),
        slug: row.slug.trim() || undefined,
      }))
      .filter((item) => item.label.length > 0)
    setSaving(true)
    try {
      const data = await putMainPageSections(marketCode, items, regionCode)
      setRows(toEditableRows(data.items))
      pushToast(t('mainPage.saveSuccess'), 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : t('mainPage.saveFailed')
      pushToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Switch market and reset locality/county to market defaults.
   *
   * @param nextMarket Newly selected market code.
   */
  function handleMarketChange(nextMarket: string): void {
    setMarketCode(nextMarket)
    if (nextMarket === US_MARKET_CODE) {
      setLocalityId(DEFAULT_US_STATE_CODE)
      setCountyId(null)
      return
    }
    setLocalityId(null)
    setCountyId(null)
  }

  /**
   * Switch state/town and clear county unless Florida remains selected.
   *
   * @param nextLocality Newly selected state or town code, or empty for default.
   */
  function handleLocalityChange(nextLocality: string): void {
    const normalized = nextLocality || null
    setLocalityId(normalized)
    setCountyId(
      marketCode === US_MARKET_CODE && normalized === FLORIDA_STATE_CODE ? countyId : null,
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-4">
        <label className="block max-w-xs text-xs font-medium text-neutral-700">
          {t('editor.scope.market')}
          <select
            value={marketCode}
            onChange={(event) => handleMarketChange(event.target.value)}
            className={SELECT_CLASS}
          >
            {EDITOR_MARKET_OPTIONS.map((market) => (
              <option key={market} value={market}>
                {market.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        {showLocality ? (
          <label className="block max-w-xs text-xs font-medium text-neutral-700">
            {marketCode === US_MARKET_CODE ? tNav('state') : tNav('town')}
            <select
              value={localityId ?? ''}
              onChange={(event) => handleLocalityChange(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">
                {marketCode === US_MARKET_CODE
                  ? tNav('localityDefaultUs')
                  : tNav('localityDefaultPr')}
              </option>
              {marketCode === US_MARKET_CODE
                ? US_STATE_OPTIONS.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.label}
                    </option>
                  ))
                : PUERTO_RICO_TOWN_OPTIONS.map((town) => (
                    <option key={town.code} value={town.code}>
                      {town.label}
                    </option>
                  ))}
            </select>
          </label>
        ) : null}

        {showFloridaCounty ? (
          <label className="block max-w-xs text-xs font-medium text-neutral-700">
            {tNav('county')}
            <select
              value={countyId ?? ''}
              onChange={(event) => setCountyId(event.target.value || null)}
              className={SELECT_CLASS}
            >
              <option value="">{tNav('county')}</option>
              {FLORIDA_COUNTY_OPTIONS.map((county) => (
                <option key={county.code} value={county.code}>
                  {county.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-600">{t('mainPage.loading')}</p>
      ) : (
        <MainPageRowsEditor rows={rows} onChange={setRows} />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void handleSave()}
          className="rounded bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? t('mainPage.saving') : t('mainPage.save')}
        </button>
      </div>
    </div>
  )
}

/**
 * Editable ordered list of main-page sections.
 */
function MainPageRowsEditor({
  rows,
  onChange,
}: {
  rows: IEditableSectionRow[]
  onChange: (rows: IEditableSectionRow[]) => void
}): JSX.Element {
  const t = useTranslations('admin')
  const hasHero = rows.some((row) => row.sectionType === 'hero')

  function updateRow(index: number, patch: Partial<IEditableSectionRow>): void {
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

  function removeRow(index: number): void {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function addSection(sectionType: MainPageSectionType): void {
    if (sectionType === 'hero' && hasHero) {
      return
    }
    const usedSlugs = new Set(rows.map((row) => row.slug))
    const canonical = CANONICAL_SLUG_BY_TYPE[sectionType]
    const slug = canonical && !usedSlugs.has(canonical) ? canonical : ''
    onChange([
      ...rows,
      {
        key: `new-${sectionType}-${Date.now()}`,
        sectionType,
        label: DEFAULT_LABEL_BY_TYPE[sectionType],
        slug,
      },
    ])
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">{t('mainPage.listHint')}</p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-2 rounded border border-neutral-200 bg-white p-3"
          >
            <span className="w-8 text-xs font-semibold text-neutral-500">{index + 1}</span>
            <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
              {t(`mainPage.types.${row.sectionType}`)}
            </span>
            <input
              value={row.label}
              onChange={(event) =>
                updateRow(index, {
                  label: event.target.value,
                  slug: row.slug ? row.slug : '',
                })
              }
              placeholder={t('mainPage.labelPlaceholder')}
              className={`${INPUT_CLASS} min-w-[12rem] flex-1`}
              aria-label={t('mainPage.labelPlaceholder')}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveRow(index, -1)}
                disabled={index === 0}
                className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                {t('mainPage.moveUp')}
              </button>
              <button
                type="button"
                onClick={() => moveRow(index, 1)}
                disabled={index === rows.length - 1}
                className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                {t('mainPage.moveDown')}
              </button>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-red-700"
              >
                {t('mainPage.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {SECTION_TYPES.map((sectionType) => {
          const disabled = sectionType === 'hero' && hasHero
          return (
            <button
              key={sectionType}
              type="button"
              disabled={disabled}
              onClick={() => addSection(sectionType)}
              className="rounded border border-dashed border-neutral-400 px-3 py-2 text-sm font-medium text-neutral-800 disabled:opacity-40"
            >
              {t(`mainPage.addType.${sectionType}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
