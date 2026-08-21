'use client'

import { useTranslations } from 'next-intl'
import { EntertainmentSectionsEditor } from '@/components/features/entertainment-sections-editor'

/**
 * Admin tab for managing ordered Entertainment page sections (hero, bands, topics).
 *
 * @returns Entertainment sections administration page.
 */
export default function EditorEntertainmentPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('entertainmentPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('entertainmentPage.subtitle')}</p>
      <EntertainmentSectionsEditor />
    </div>
  )
}
