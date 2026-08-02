'use client'

import { useTranslations } from 'next-intl'
import { WorldSectionsEditor } from '@/components/features/world-sections-editor'

/**
 * Admin tab for managing ordered World page sections (hero, bands, regions).
 *
 * @returns World-page sections administration page.
 */
export default function EditorWorldPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('worldPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('worldPage.subtitle')}</p>
      <WorldSectionsEditor />
    </div>
  )
}
