'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import {
  PageAdsEditor,
  toApiAdRows,
  toEditableAdRows,
  type IEditableAdRow,
} from '@/components/features/page-ads-editor'
import {
  SortableConfigRow,
  SortableDragPreview,
} from '@/components/ui/sortable-config-row'
import { useSortableListDrag } from '@/hooks/use-sortable-list-drag'
import {
  getEntertainmentPageSections,
  putEntertainmentPageSections,
  type IEntertainmentPageSectionItem,
  type EntertainmentPageSectionType,
} from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS, type IEditorScope } from '@/lib/editor/editor-scope'
import {
  FLORIDA_COUNTY_OPTIONS,
  FLORIDA_STATE_CODE,
} from '@/lib/florida-counties'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import { allocateSectionSlug } from '@/lib/helpers/allocate-section-slug'
import { moveListItem } from '@/lib/helpers/move-list-item'
import { PUERTO_RICO_MARKET_CODE, PUERTO_RICO_TOWN_OPTIONS } from '@/lib/puerto-rico-towns'
import { toRegionCode } from '@/lib/region-code'
import { US_MARKET_CODE, US_STATE_OPTIONS } from '@/lib/us-states'

/** Placement / entertainment boards share this page name when syncing slots. */
const ENTERTAINMENT_EDITOR_PAGE_NAME = 'entertainment'

const SELECT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm capitalize'
const INPUT_CLASS =
  'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm'

const SECTION_TYPES: EntertainmentPageSectionType[] = [
  'hero',
  'top_stories',
  'live',
  'entertainment',
  'ribbon_ad',
]

const DEFAULT_LABEL_BY_TYPE: Record<EntertainmentPageSectionType, string> = {
  hero: 'Entertainment',
  top_stories: 'Top Stories',
  live: 'Live',
  entertainment: '',
  ribbon_ad: 'Ribbon Advertisement',
}

const CANONICAL_SLUG_BY_TYPE: Partial<Record<EntertainmentPageSectionType, string>> = {
  hero: 'hero',
  top_stories: 'us-featured',
  live: 'health',
}

const PREFERRED_SLUG_PREFIX_BY_TYPE: Partial<Record<EntertainmentPageSectionType, string>> = {
  ribbon_ad: 'ad-ribbon',
  entertainment: 'topic',
}

interface IEditableSectionRow {
  key: string
  sectionType: EntertainmentPageSectionType
  label: string
  slug: string
}

/**
 * Build local editable rows from API items.
 *
 * @param items Saved entertainment section items.
 * @returns Editable row models with stable keys.
 */
function toEditableRows(items: IEntertainmentPageSectionItem[]): IEditableSectionRow[] {
  return items.map((item, index) => ({
    key: `${item.slug}-${index}`,
    sectionType: item.section_type,
    label: item.label,
    slug: item.slug,
  }))
}

/**
 * Region code for entertainment section scope (country, state, county, or town).
 *
 * Must match Placement's `editorScopeRegionCode`: USA with no state is `us`,
 * not a market-level null board that Placement never reads.
 *
 * @param marketCode Selected market code.
 * @param localityId US state or PR town short code.
 * @param countyId Optional Florida county slug.
 * @returns Region code such as `us`, `us-fl`, or `pr-san-juan`.
 */
function entertainmentSectionsRegionCode(
  marketCode: string,
  localityId: string | null,
  countyId: string | null,
): string {
  return toRegionCode(marketCode, localityId, countyId)
}

/**
 * Build the editor scope used to invalidate Placement after a entertainment save.
 *
 * @param marketCode Active market code.
 * @param localityId US state or PR town short code.
 * @param countyId Optional Florida county slug.
 * @returns Scope matching the entertainment board that was just written.
 */
function entertainmentEditorScope(
  marketCode: string,
  localityId: string | null,
  countyId: string | null,
): IEditorScope {
  return {
    marketCode,
    townId: localityId,
    countyId,
    pageName: ENTERTAINMENT_EDITOR_PAGE_NAME,
  }
}

/**
 * Admin editor for the ordered entertainment page section list of one geo scope.
 *
 * @returns Entertainment sections administration UI.
 */
export function EntertainmentSectionsEditor(): JSX.Element {
  const t = useTranslations('admin')
  const tNav = useTranslations('navigation')
  const { pushToast } = useToast()
  const [marketCode, setMarketCode] = useState('pr')
  const [localityId, setLocalityId] = useState<string | null>(null)
  const [countyId, setCountyId] = useState<string | null>(null)
  const [rows, setRows] = useState<IEditableSectionRow[]>([])
  const [adRows, setAdRows] = useState<IEditableAdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const showLocality = marketCode === US_MARKET_CODE || marketCode === PUERTO_RICO_MARKET_CODE
  const showFloridaCounty = marketCode === US_MARKET_CODE && localityId === FLORIDA_STATE_CODE
  const regionCode = entertainmentSectionsRegionCode(marketCode, localityId, countyId)

  useEffect(() => {
    let cancelled = false

    async function loadSections(): Promise<void> {
      setLoading(true)
      try {
        const data = await getEntertainmentPageSections(marketCode, regionCode)
        if (!cancelled) {
          setRows(toEditableRows(data.items))
          setAdRows(toEditableAdRows(data.ads))
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : t('entertainmentPage.loadFailed')
          pushToast(message, 'error')
          setRows([])
          setAdRows([])
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
      const data = await putEntertainmentPageSections(marketCode, items, regionCode, toApiAdRows(adRows))
      setRows(toEditableRows(data.items))
      setAdRows(toEditableAdRows(data.ads))
      notifyEditorialPreviewStale(entertainmentEditorScope(marketCode, localityId, countyId))
      pushToast(t('entertainmentPage.saveSuccess'), 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : t('entertainmentPage.saveFailed')
      pushToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Switch market and reset to the market-level scope (USA or Puerto Rico).
   *
   * @param nextMarket Newly selected market code.
   */
  function handleMarketChange(nextMarket: string): void {
    setMarketCode(nextMarket)
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
        <p className="text-sm text-neutral-600">{t('entertainmentPage.loading')}</p>
      ) : (
        <>
          <EntertainmentRowsEditor rows={rows} onChange={setRows} />
          <PageAdsEditor rows={adRows} onChange={setAdRows} />
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void handleSave()}
          className="rounded bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? t('entertainmentPage.saving') : t('entertainmentPage.save')}
        </button>
      </div>
    </div>
  )
}

/**
 * Editable ordered list of entertainment page sections (hero, bands, entertainment).
 */
function EntertainmentRowsEditor({
  rows,
  onChange,
}: {
  rows: IEditableSectionRow[]
  onChange: (rows: IEditableSectionRow[]) => void
}): JSX.Element {
  const t = useTranslations('admin')
  const hasHero = rows.some((row) => row.sectionType === 'hero')
  const {
    dragIndex,
    overIndex,
    preview,
    beginDrag,
    updatePointer,
    setHoverIndex,
    completeDrop,
  } = useSortableListDrag({ items: rows, onReorder: onChange })

  function updateRow(index: number, patch: Partial<IEditableSectionRow>): void {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function moveRow(index: number, delta: number): void {
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= rows.length) {
      return
    }
    onChange(moveListItem(rows, index, nextIndex))
  }

  function removeRow(index: number): void {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function addSection(sectionType: EntertainmentPageSectionType): void {
    if (sectionType === 'hero' && hasHero) {
      return
    }
    const usedSlugs = new Set(rows.map((row) => row.slug).filter(Boolean))
    const slug = allocateSectionSlug({
      sectionType,
      label: DEFAULT_LABEL_BY_TYPE[sectionType],
      usedSlugs,
      canonicalByType: CANONICAL_SLUG_BY_TYPE,
      preferredPrefixByType: PREFERRED_SLUG_PREFIX_BY_TYPE,
    })
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

  const previewRow = preview ? rows[preview.index] : null

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">{t('entertainmentPage.listHint')}</p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <SortableConfigRow
            key={row.key}
            index={index}
            isDragging={dragIndex === index}
            isDropTarget={overIndex === index}
            dragHandleLabel={t('entertainmentPage.dragHandle')}
            onDragStart={beginDrag}
            onDrag={updatePointer}
            onDragOver={setHoverIndex}
            onDrop={completeDrop}
          >
            <EntertainmentRowFields
              row={row}
              index={index}
              rowCount={rows.length}
              onUpdate={updateRow}
              onMove={moveRow}
              onRemove={removeRow}
            />
          </SortableConfigRow>
        ))}
      </ul>
      {preview && previewRow ? (
        <SortableDragPreview preview={preview}>
          <EntertainmentRowPreview row={previewRow} index={preview.index} />
        </SortableDragPreview>
      ) : null}
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
              {t(`entertainmentPage.addType.${sectionType}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface IEntertainmentRowFieldsProps {
  row: IEditableSectionRow
  index: number
  rowCount: number
  onUpdate: (index: number, patch: Partial<IEditableSectionRow>) => void
  onMove: (index: number, delta: number) => void
  onRemove: (index: number) => void
}

/**
 * Inline editors and move/remove controls for one entertainment section row.
 */
function EntertainmentRowFields(props: IEntertainmentRowFieldsProps): JSX.Element {
  const { row, index, rowCount, onUpdate, onMove, onRemove } = props
  const t = useTranslations('admin')

  return (
    <>
      <span className="w-8 text-xs font-semibold text-neutral-500">{index + 1}</span>
      <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
        {t(`entertainmentPage.types.${row.sectionType}`)}
      </span>
      <input
        value={row.label}
        onChange={(event) =>
          onUpdate(index, {
            label: event.target.value,
            slug: row.slug ? row.slug : '',
          })
        }
        placeholder={t('entertainmentPage.labelPlaceholder')}
        className={`${INPUT_CLASS} min-w-[12rem] flex-1`}
        aria-label={t('entertainmentPage.labelPlaceholder')}
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40"
        >
          {t('entertainmentPage.moveUp')}
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === rowCount - 1}
          className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40"
        >
          {t('entertainmentPage.moveDown')}
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-red-700"
        >
          {t('entertainmentPage.remove')}
        </button>
      </div>
    </>
  )
}

/**
 * Compact floating preview content for a dragged entertainment row.
 */
function EntertainmentRowPreview({
  row,
  index,
}: {
  row: IEditableSectionRow
  index: number
}): JSX.Element {
  const t = useTranslations('admin')
  return (
    <>
      <span className="w-8 text-xs font-semibold text-neutral-500">{index + 1}</span>
      <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
        {t(`entertainmentPage.types.${row.sectionType}`)}
      </span>
      <span className="min-w-[12rem] flex-1 truncate text-sm font-medium text-neutral-900">
        {row.label || t('entertainmentPage.labelPlaceholder')}
      </span>
    </>
  )
}
