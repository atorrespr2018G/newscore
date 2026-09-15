'use client'

import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { useGenerationLoading } from '@/hooks/use-generation-loading'
import {
  getPageVisibility,
  putPageVisibility,
  type IPageVisibilityOut,
} from '@/lib/api/layout-client'
import { useState } from 'react'

interface IPageEnabledToggleProps {
  /** Layout page name such as `sports`. */
  pageName: string
  /** Active market code. */
  marketCode: string
  /** Active region code such as `us`, `us-fl`, or `pr-san-juan`. */
  regionCode: string | null
}

/**
 * Configuration control to hide a landing page at the selected geo.
 *
 * Disabling a country hides the page for every nested state, county, and town.
 * A state disable covers that state and its counties. A town or county disable
 * applies to that locality only. A child cannot turn the page back on while a
 * parent geo has it disabled.
 *
 * @param props Page, market, and region scope for the toggle.
 * @returns Enable/disable checkbox for the current Configuration scope.
 */
export function PageEnabledToggle({
  pageName,
  marketCode,
  regionCode,
}: IPageEnabledToggleProps): JSX.Element {
  const t = useTranslations('admin.pageVisibility')
  const { pushToast } = useToast()
  const [visibility, setVisibility] = useState<IPageVisibilityOut | null>(null)
  const [saving, setSaving] = useState(false)
  const scopeKey = `${pageName}:${marketCode}:${regionCode ?? ''}`

  const loading = useGenerationLoading(scopeKey, async (isCurrent) => {
    try {
      const data = await getPageVisibility(pageName, marketCode, regionCode)
      if (isCurrent()) {
        setVisibility(data)
      }
    } catch (error) {
      if (!isCurrent()) {
        return
      }
      const message = error instanceof Error ? error.message : t('loadFailed')
      pushToast(message, 'error')
      setVisibility(null)
    }
  })

  return (
    <PageEnabledToggleBody
      visibility={visibility}
      loading={loading}
      saving={saving}
      onToggle={(enabled) => {
        void persistEnabled({
          pageName,
          marketCode,
          regionCode,
          enabled,
          setSaving,
          setVisibility,
          pushToast,
          saveFailed: t('saveFailed'),
        })
      }}
      labels={{
        enabled: t('enabled'),
        hint: t('hint'),
        inherited: t('inherited', {
          region: visibility?.disabled_by_region_code?.toUpperCase() ?? '',
        }),
        loading: t('loading'),
      }}
    />
  )
}

/**
 * Persist a local enable/disable change for the selected geo.
 */
async function persistEnabled(options: {
  pageName: string
  marketCode: string
  regionCode: string | null
  enabled: boolean
  setSaving: (saving: boolean) => void
  setVisibility: (value: IPageVisibilityOut) => void
  pushToast: (message: string, kind: 'error') => void
  saveFailed: string
}): Promise<void> {
  options.setSaving(true)
  try {
    const data = await putPageVisibility(
      options.pageName,
      options.marketCode,
      options.enabled,
      options.regionCode,
    )
    options.setVisibility(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : options.saveFailed
    options.pushToast(message, 'error')
  } finally {
    options.setSaving(false)
  }
}

/**
 * Checkbox and helper copy for the page-enable control.
 */
function PageEnabledToggleBody({
  visibility,
  loading,
  saving,
  onToggle,
  labels,
}: {
  visibility: IPageVisibilityOut | null
  loading: boolean
  saving: boolean
  onToggle: (enabled: boolean) => void
  labels: {
    enabled: string
    hint: string
    inherited: string
    loading: string
  }
}): JSX.Element {
  const inherited = visibility?.inherited === true
  const checked = visibility?.is_effectively_enabled !== false
  const disabled = loading || saving || visibility === null || inherited

  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3">
      <label className="flex items-start gap-2 text-sm text-neutral-800">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>
          <span className="font-medium">{labels.enabled}</span>
          <span className="mt-1 block text-xs font-normal text-neutral-600">
            {loading ? labels.loading : inherited ? labels.inherited : labels.hint}
          </span>
        </span>
      </label>
    </div>
  )
}
