'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useEditorScopeContext } from '@/context/editor-scope-context'
import {
  FLORIDA_COUNTY_OPTIONS,
  FLORIDA_STATE_CODE,
} from '@/lib/florida-counties'
import { PUERTO_RICO_MARKET_CODE, PUERTO_RICO_TOWN_OPTIONS } from '@/lib/puerto-rico-towns'
import { US_MARKET_CODE, US_STATE_OPTIONS } from '@/lib/us-states'
import { TECHNOLOGY_PAGE_NAME } from '@/lib/helpers/technology-archive'
import { listCustomTabs } from '@/lib/api/layout-client'
import {
  DEFAULT_EDITOR_MARKET_CODE,
  DEFAULT_EDITOR_PAGE_NAME,
  EDITOR_MARKET_OPTIONS,
  EDITOR_PAGE_OPTIONS,
  type IEditorScope,
} from '@/lib/editor/editor-scope'

const SELECT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm capitalize'

/**
 * Return whether a page name is a built-in Placement option.
 *
 * @param pageName Candidate page name.
 * @returns True when the page is in EDITOR_PAGE_OPTIONS.
 */
function isBuiltInEditorPage(pageName: string): boolean {
  return (EDITOR_PAGE_OPTIONS as ReadonlyArray<string>).includes(pageName)
}

/**
 * Resolve the page name to use after a market change.
 *
 * Custom tabs are market-scoped. Keep built-in pages; otherwise fall back to
 * homepage immediately so Placement does not fetch an invalid page/market pair
 * while the new market's tab list is still loading.
 *
 * @param pageName Current or requested page name.
 * @returns Safe page name for the next market.
 */
function pageNameForMarketChange(pageName: string): string {
  if (isBuiltInEditorPage(pageName)) {
    return pageName
  }
  return DEFAULT_EDITOR_PAGE_NAME
}

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
  const tNav = useTranslations('navigation')
  const { scope, setScope } = useEditorScopeContext()
  const [customPageNames, setCustomPageNames] = useState<string[]>([])
  const [customPagesReady, setCustomPagesReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Drop stale market tabs immediately so PR-only pages cannot stay selected
    // (or listed) while the US tab list is still in flight.
    setCustomPageNames([])
    setCustomPagesReady(false)

    async function loadCustomPages(): Promise<void> {
      try {
        const tabs = await listCustomTabs(scope.marketCode)
        if (!cancelled) {
          setCustomPageNames(tabs.map((tab) => tab.slug))
          setCustomPagesReady(true)
        }
      } catch {
        if (!cancelled) {
          setCustomPageNames([])
          setCustomPagesReady(true)
        }
      }
    }
    void loadCustomPages()
    return () => {
      cancelled = true
    }
  }, [scope.marketCode])

  // Safety net: if a custom page is still selected after the new market's tabs
  // load and it is not in that list, reset to homepage.
  useEffect(() => {
    if (!customPagesReady) {
      return
    }
    if (isBuiltInEditorPage(scope.pageName) || customPageNames.includes(scope.pageName)) {
      return
    }
    setScope({
      marketCode: scope.marketCode,
      townId: scope.townId,
      countyId: scope.countyId,
      pageName: DEFAULT_EDITOR_PAGE_NAME,
    })
  }, [
    customPageNames,
    customPagesReady,
    scope.countyId,
    scope.marketCode,
    scope.pageName,
    scope.townId,
    setScope,
  ])

  const pageOptions = [...EDITOR_PAGE_OPTIONS, ...customPageNames]
  // Keep the current value selectable until market tabs finish loading / reset,
  // otherwise a controlled <select> with a missing option freezes the UI.
  if (!pageOptions.includes(scope.pageName)) {
    pageOptions.push(scope.pageName)
  }

  /**
   * Apply a partial scope change, resetting town when the market changes.
   *
   * @param patch Scope fields to override.
   */
  function updateScope(patch: Partial<IEditorScope>): void {
    const marketChanged =
      patch.marketCode !== undefined && patch.marketCode !== scope.marketCode
    const requestedPage = patch.pageName ?? scope.pageName
    const nextPage = marketChanged ? pageNameForMarketChange(requestedPage) : requestedPage

    if (marketChanged) {
      setCustomPageNames([])
      setCustomPagesReady(false)
    }

    if (nextPage === TECHNOLOGY_PAGE_NAME) {
      setScope({
        ...scope,
        ...patch,
        pageName: TECHNOLOGY_PAGE_NAME,
        marketCode: DEFAULT_EDITOR_MARKET_CODE,
        townId: null,
        countyId: null,
      })
      return
    }
    setScope({ ...scope, ...patch, pageName: nextPage })
  }

  const showLocality =
    scope.pageName !== TECHNOLOGY_PAGE_NAME &&
    (scope.marketCode === US_MARKET_CODE || scope.marketCode === PUERTO_RICO_MARKET_CODE)
  const showMarket = scope.pageName !== TECHNOLOGY_PAGE_NAME
  const showFloridaCounty =
    showLocality && scope.marketCode === US_MARKET_CODE && scope.townId === FLORIDA_STATE_CODE

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      {showMarket ? (
        <label className="text-xs font-medium text-neutral-700">
          {t('editor.scope.market')}
          <select
            value={scope.marketCode}
            onChange={(event) => {
              const nextMarket = event.target.value
              // Reset custom-tab pages synchronously on market change. Waiting for
              // listCustomTabs leaves Placement on e.g. page=test + market=us and
              // the canvas hangs on loading.
              setCustomPageNames([])
              setCustomPagesReady(false)
              setScope({
                marketCode: nextMarket,
                townId: null,
                countyId: null,
                pageName: pageNameForMarketChange(scope.pageName),
              })
            }}
            className={SELECT_CLASS}
          >
            {EDITOR_MARKET_OPTIONS.map((market) => (
              <option key={market} value={market}>
                {market.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-xs font-medium text-neutral-700">
        {t('editor.scope.page')}
        <select
          value={scope.pageName}
          onChange={(event) => updateScope({ pageName: event.target.value })}
          className={SELECT_CLASS}
        >
          {pageOptions.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </select>
      </label>
      {showLocality ? (
        <label className="text-xs font-medium text-neutral-700">
          {scope.marketCode === US_MARKET_CODE ? tNav('state') : tNav('town')}
          <select
            value={scope.townId ?? ''}
            onChange={(event) =>
              updateScope({
                townId: event.target.value || null,
                countyId:
                  scope.marketCode === US_MARKET_CODE && event.target.value === FLORIDA_STATE_CODE
                    ? scope.countyId
                    : null,
              })
            }
            className={SELECT_CLASS}
          >
            <option value="">
              {scope.marketCode === US_MARKET_CODE ? tNav('localityDefaultUs') : tNav('localityDefaultPr')}
            </option>
            {scope.marketCode === US_MARKET_CODE
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
        <label className="text-xs font-medium text-neutral-700">
          {tNav('county')}
          <select
            value={scope.countyId ?? ''}
            onChange={(event) => updateScope({ countyId: event.target.value || null })}
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
  )
}
