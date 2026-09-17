'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import {
  listMarkets,
  placeArticleWorldwide,
  type IMarketOut,
  type IWorldwidePlacementOut,
} from '@/lib/api/layout-client'
import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import type { IArticleDetail, IArticlePlacementRef } from '@/interfaces/editor-article'
import {
  WORLDWIDE_PLACEMENT_SLOT_OPTIONS,
  worldwideSlotMaxPosition,
} from '@/lib/helpers/worldwide-placement'

interface IWorldwideArticleControlsProps {
  articleId: string
  worldwide: boolean
  setWorldwide: Dispatch<SetStateAction<boolean>>
  excludedMarketIds: string[]
  setExcludedMarketIds: Dispatch<SetStateAction<string[]>>
  onDirty: () => void
  onPlacementResult: (result: IWorldwidePlacementOut) => void
  onPlacementError: (message: string) => void
}

/**
 * Worldwide targeting, market exclusions, and cross-market placement controls.
 *
 * @param props Article targeting state and placement callbacks.
 * @returns The worldwide editing controls.
 */
export function WorldwideArticleControls({
  articleId,
  worldwide,
  setWorldwide,
  excludedMarketIds,
  setExcludedMarketIds,
  onDirty,
  onPlacementResult,
  onPlacementError,
}: IWorldwideArticleControlsProps): JSX.Element {
  const t = useTranslations('admin')
  const [markets, setMarkets] = useState<IMarketOut[]>([])
  const [positionKey, setPositionKey] = useState(WORLDWIDE_PLACEMENT_SLOT_OPTIONS[0].positionKey)
  const [position, setPosition] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [placementRefs, setPlacementRefs] = useState<IArticlePlacementRef[]>([])

  const refreshPlacementRefs = useCallback(async (): Promise<void> => {
    if (!articleId) {
      setPlacementRefs([])
      return
    }
    try {
      const detail = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
      setPlacementRefs(detail.placement_refs ?? [])
    } catch {
      setPlacementRefs([])
    }
  }, [articleId])

  useEffect(() => {
    let cancelled = false
    void listMarkets()
      .then((items) => {
        if (!cancelled) {
          setMarkets(items)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarkets([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void refreshPlacementRefs()
  }, [refreshPlacementRefs])

  const maxPosition = worldwideSlotMaxPosition(positionKey)

  /**
   * Toggle whether a market is excluded from worldwide targeting.
   *
   * @param marketId Market document id.
   * @param excluded Whether the market should be excluded.
   */
  function toggleExclusion(marketId: string, excluded: boolean): void {
    onDirty()
    setExcludedMarketIds((current) => {
      if (excluded) {
        return current.includes(marketId) ? current : [...current, marketId]
      }
      return current.filter((id) => id !== marketId)
    })
  }

  /**
   * Fan the article out to the chosen slot across effective markets.
   */
  async function handlePlaceWorldwide(): Promise<void> {
    setPlacing(true)
    try {
      const result = await placeArticleWorldwide({
        article_id: articleId,
        page_name: 'homepage',
        position_key: positionKey,
        position,
        publish: true,
      })
      await refreshPlacementRefs()
      onPlacementResult(result)
    } catch (err) {
      onPlacementError(err instanceof Error ? err.message : t('editor.errors.worldwidePlacement'))
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <input
          type="checkbox"
          checked={worldwide}
          onChange={(event) => {
            onDirty()
            setWorldwide(event.target.checked)
            if (!event.target.checked) {
              setExcludedMarketIds([])
            }
          }}
        />
        {t('editor.worldwide.toggle')}
      </label>
      <p className="text-xs text-neutral-500">{t('editor.worldwide.hint')}</p>

      {worldwide ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-neutral-700">
            {t('editor.worldwide.excludeHeading')}
          </legend>
          <p className="text-xs text-neutral-500">{t('editor.worldwide.excludeHint')}</p>
          <div className="flex flex-wrap gap-3">
            {markets.map((market) => {
              const excluded = excludedMarketIds.includes(market.id)
              return (
                <label key={market.id} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={excluded}
                    onChange={(event) => toggleExclusion(market.id, event.target.checked)}
                  />
                  {market.label || market.code}
                </label>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {worldwide ? (
        <div className="space-y-2 border-t border-neutral-200 pt-3">
          <p className="text-sm font-medium text-neutral-700">{t('editor.worldwide.placementHeading')}</p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-600">
              {t('editor.worldwide.placedOnHeading')}
            </p>
            {placementRefs.length === 0 ? (
              <p className="text-xs text-neutral-500">{t('editor.worldwide.placedOnEmpty')}</p>
            ) : (
              <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-neutral-700">
                {placementRefs.map((ref) => (
                  <li key={`${ref.slot_id}:${ref.position_key}:${ref.position}`}>
                    {t('editor.worldwide.placedOnRow', {
                      region: ref.region_code || ref.market_code || ref.market_id,
                      slot: ref.position_key,
                      position: ref.position + 1,
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm text-neutral-700">
              {t('editor.worldwide.slot')}
              <select
                value={positionKey}
                onChange={(event) => {
                  setPositionKey(event.target.value)
                  setPosition(0)
                }}
                className="mt-1 block rounded border border-neutral-300 px-2 py-1"
              >
                {WORLDWIDE_PLACEMENT_SLOT_OPTIONS.map((option) => (
                  <option key={option.positionKey} value={option.positionKey}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-neutral-700">
              {t('editor.worldwide.position')}
              <select
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
                className="mt-1 block rounded border border-neutral-300 px-2 py-1"
              >
                {Array.from({ length: maxPosition + 1 }, (_, index) => (
                  <option key={index} value={index}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={placing}
            onClick={() => void handlePlaceWorldwide()}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {placing ? t('editor.worldwide.placing') : t('editor.worldwide.placeButton')}
          </button>
          <p className="text-xs text-neutral-500">{t('editor.worldwide.placementHint')}</p>
        </div>
      ) : null}
    </div>
  )
}
