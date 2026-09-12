'use client'

import { useTranslations } from 'next-intl'
import { PoliticsSectionsEditor } from '@/components/features/politics-sections-editor'

/**
 * Admin tab for managing ordered Politics page sections (hero, bands, topics).
 *
 * @returns Politics-page sections administration page.
 */
export default function EditorPoliticsPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('politicsPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('politicsPage.subtitle')}</p>
      <PoliticsSectionsEditor />
    </div>
  )
}
