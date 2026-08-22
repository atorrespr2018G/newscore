'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { createCustomTab } from '@/lib/api/layout-client'
import { EDITOR_MARKET_OPTIONS } from '@/lib/editor/editor-scope'

const INPUT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm'
const SELECT_CLASS =
  'mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm capitalize'

/**
 * Derive a kebab-case slug from a tab label for the create form.
 *
 * @param label Display label.
 * @returns Suggested slug.
 */
function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Form to register a new market-scoped custom tab, then open its editor.
 *
 * @returns Create-tab administration UI.
 */
export function CreateCustomTabForm(): JSX.Element {
  const t = useTranslations('admin')
  const { pushToast } = useToast()
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [marketCode, setMarketCode] = useState(EDITOR_MARKET_OPTIONS[0] ?? 'us')
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  /**
   * Create the tab for the selected market and open its section editor.
   *
   * @param event Submit event.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      pushToast(t('customTabs.labelRequired'), 'error')
      return
    }
    setSaving(true)
    try {
      const tab = await createCustomTab(
        trimmedLabel,
        marketCode,
        slug.trim() || undefined,
      )
      pushToast(t('customTabs.createSuccess'), 'success')
      router.push(`/admin/editor/tabs/${encodeURIComponent(tab.slug)}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('customTabs.createFailed')
      pushToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-4">
      <label className="block text-xs font-medium text-neutral-700">
        {t('customTabs.marketField')}
        <select
          value={marketCode}
          onChange={(event) => setMarketCode(event.target.value)}
          className={SELECT_CLASS}
          required
        >
          {EDITOR_MARKET_OPTIONS.map((market) => (
            <option key={market} value={market}>
              {market.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-neutral-700">
        {t('customTabs.labelField')}
        <input
          value={label}
          onChange={(event) => {
            const next = event.target.value
            setLabel(next)
            if (!slugTouched) {
              setSlug(slugifyLabel(next))
            }
          }}
          className={INPUT_CLASS}
          maxLength={80}
          required
        />
      </label>
      <label className="block text-xs font-medium text-neutral-700">
        {t('customTabs.slugField')}
        <input
          value={slug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(event.target.value)
          }}
          className={INPUT_CLASS}
          maxLength={80}
          placeholder={t('customTabs.slugPlaceholder')}
        />
      </label>
      <p className="text-xs text-neutral-500">{t('customTabs.createHint')}</p>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-[color:var(--brand-red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? t('customTabs.creating') : t('customTabs.create')}
      </button>
    </form>
  )
}
