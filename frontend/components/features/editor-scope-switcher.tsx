'use client'

import { useTranslations } from 'next-intl'
import { useEditorScopeContext } from '@/context/editor-scope-context'
import {
  EDITOR_MARKET_OPTIONS,
  EDITOR_PAGE_OPTIONS,
  type IEditorScope,
} from '@/lib/editor/editor-scope'

const SELECT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm capitalize'

/**
 * Market and page selector that drives every editor read/write scope.
 *
 * Switching scope re-loads the pool, slots, and placements for the chosen
 * market/page so editors can curate world pages and other markets in-app.
 *
 * @returns The scope switcher control row.
 */
export function EditorScopeSwitcher(): JSX.Element {
  const t = useTranslations('admin')
  const { scope, setScope } = useEditorScopeContext()

  /**
   * Apply a partial scope change, resetting town when the market changes.
   *
   * @param patch Scope fields to override.
   */
  function updateScope(patch: Partial<IEditorScope>): void {
    setScope({ ...scope, ...patch })
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <label className="text-xs font-medium text-neutral-700">
        {t('editor.scope.market')}
        <select
          value={scope.marketCode}
          onChange={(event) => updateScope({ marketCode: event.target.value, townId: null })}
          className={SELECT_CLASS}
        >
          {EDITOR_MARKET_OPTIONS.map((market) => (
            <option key={market} value={market}>
              {market.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-neutral-700">
        {t('editor.scope.page')}
        <select
          value={scope.pageName}
          onChange={(event) => updateScope({ pageName: event.target.value })}
          className={SELECT_CLASS}
        >
          {EDITOR_PAGE_OPTIONS.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
