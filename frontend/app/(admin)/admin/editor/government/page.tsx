'use client'

import { useTranslations } from 'next-intl'
import { GovernmentSectionsEditor } from '@/components/features/government-sections-editor'

/**
 * Admin tab for managing ordered Government page sections (hero, bands, topics).
 *
 * @returns Government sections administration page.
 */
export default function EditorGovernmentPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('governmentPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('governmentPage.subtitle')}</p>
      <GovernmentSectionsEditor />
    </div>
  )
}
