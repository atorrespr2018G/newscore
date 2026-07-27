'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import {
  getSportsPageSections,
  putSportsPageSections,
  type ISportsPageSectionItem,
} from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS } from '@/lib/editor/editor-scope'

const SELECT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm capitalize'
const INPUT_CLASS =
  'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm'

interface IEditableSportRow {
  key: string
  label: string
  slug: string
}

/**
 * Build local editable rows from API items.
 *
 * @param items Saved sports section items.
 * @returns Editable row models with stable keys.
 */
function toEditableRows(items: ISportsPageSectionItem[]): IEditableSportRow[] {
  return items.map((item, index) => ({
    key: `${item.slug}-${index}`,
    label: item.label,
    slug: item.slug,
  }))
}

/**
 * Admin editor for the ordered sports section list of one market.
 *
 * @returns Sports sections administration UI.
 */
export function SportsSectionsEditor(): JSX.Element {
  const t = useTranslations('admin')
  const { pushToast } = useToast()
  const [marketCode, setMarketCode] = useState('pr')
  const [rows, setRows] = useState<IEditableSportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSections(): Promise<void> {
      setLoading(true)
      try {
        const data = await getSportsPageSections(marketCode)
        if (!cancelled) {
          setRows(toEditableRows(data.items))
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : t('sportsPage.loadFailed')
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
  }, [marketCode, pushToast, t])

  /**
   * Persist the current ordered list for the selected market.
   */
  async function handleSave(): Promise<void> {
    const items = rows
      .map((row) => ({ label: row.label.trim(), slug: row.slug.trim() || undefined }))
      .filter((item) => item.label.length > 0)
    setSaving(true)
    try {
      const data = await putSportsPageSections(marketCode, items)
      setRows(toEditableRows(data.items))
      pushToast(t('sportsPage.saveSuccess'), 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : t('sportsPage.saveFailed')
      pushToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="block max-w-xs text-xs font-medium text-neutral-700">
        {t('editor.scope.market')}
        <select
          value={marketCode}
          onChange={(event) => setMarketCode(event.target.value)}
          className={SELECT_CLASS}
        >
          {EDITOR_MARKET_OPTIONS.map((market) => (
            <option key={market} value={market}>
              {market.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <p className="text-sm text-neutral-600">{t('sportsPage.loading')}</p>
      ) : (
        <SportsRowsEditor rows={rows} onChange={setRows} />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void handleSave()}
          className="rounded bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? t('sportsPage.saving') : t('sportsPage.save')}
        </button>
      </div>
    </div>
  )
}

/**
 * Editable ordered list of sport labels.
 */
function SportsRowsEditor({
  rows,
  onChange,
}: {
  rows: IEditableSportRow[]
  onChange: (rows: IEditableSportRow[]) => void
}): JSX.Element {
  const t = useTranslations('admin')

  function updateRow(index: number, patch: Partial<IEditableSportRow>): void {
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

  function addRow(): void {
    onChange([
      ...rows,
      {
        key: `new-${Date.now()}`,
        label: '',
        slug: '',
      },
    ])
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">{t('sportsPage.listHint')}</p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-2 rounded border border-neutral-200 bg-white p-3"
          >
            <span className="w-8 text-xs font-semibold text-neutral-500">{index + 1}</span>
            <input
              value={row.label}
              onChange={(event) => updateRow(index, { label: event.target.value, slug: '' })}
              placeholder={t('sportsPage.labelPlaceholder')}
              className={`${INPUT_CLASS} min-w-[12rem] flex-1`}
              aria-label={t('sportsPage.labelPlaceholder')}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveRow(index, -1)}
                disabled={index === 0}
                className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                {t('sportsPage.moveUp')}
              </button>
              <button
                type="button"
                onClick={() => moveRow(index, 1)}
                disabled={index === rows.length - 1}
                className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                {t('sportsPage.moveDown')}
              </button>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-red-700"
              >
                {t('sportsPage.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addRow}
        className="rounded border border-dashed border-neutral-400 px-3 py-2 text-sm font-medium text-neutral-800"
      >
        {t('sportsPage.addSport')}
      </button>
    </div>
  )
}
