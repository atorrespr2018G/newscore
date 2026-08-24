'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { CustomSectionsEditor } from '@/components/features/custom-sections-editor'
import { deleteCustomTab, listCustomTabs, type ICustomTab } from '@/lib/api/layout-client'
import { useGenerationLoading } from '@/hooks/use-generation-loading'

/**
 * Configuration editor for one registered custom tab.
 *
 * @returns Custom tab sections administration page.
 */
export default function EditCustomTabPage(): JSX.Element {
  const t = useTranslations('admin')
  const { pushToast } = useToast()
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(String(params.slug ?? '')).trim().toLowerCase()
  const [tab, setTab] = useState<ICustomTab | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loading = useGenerationLoading(slug, async (isCurrent) => {
    try {
      const tabs = await listCustomTabs()
      if (!isCurrent()) {
        return
      }
      const match = tabs.find((item) => item.slug === slug) ?? null
      setTab(match)
      setError(match ? null : t('customTabs.notFound'))
    } catch (loadError) {
      if (!isCurrent()) {
        return
      }
      setTab(null)
      setError(loadError instanceof Error ? loadError.message : t('customTabs.loadFailed'))
    }
  })

  /**
   * Confirm and delete the custom tab, then return to Create Tab.
   */
  async function handleDelete(): Promise<void> {
    if (!tab) {
      return
    }
    const confirmed = window.confirm(
      t('customTabs.deleteConfirm', {
        label: tab.label,
        market: tab.market_code.toUpperCase(),
      }),
    )
    if (!confirmed) {
      return
    }
    setDeleting(true)
    try {
      await deleteCustomTab(tab.slug)
      pushToast(t('customTabs.deleteSuccess'), 'success')
      router.push('/admin/editor/tabs')
      router.refresh()
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : t('customTabs.deleteFailed')
      pushToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>
  }
  if (loading || !tab) {
    return <p className="text-sm text-neutral-600">{t('customTabs.loading')}</p>
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            {tab.label}{' '}
            <span className="text-base font-semibold text-neutral-500">
              ({tab.market_code.toUpperCase()})
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('customTabs.editSubtitle')}</p>
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleDelete()}
          className="rounded border border-red-700 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? t('customTabs.deleting') : t('customTabs.delete')}
        </button>
      </div>
      <CustomSectionsEditor
        pageName={tab.slug}
        tabLabel={tab.label}
        marketCode={tab.market_code}
      />
    </div>
  )
}
