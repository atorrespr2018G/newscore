'use client'

import { useTranslations } from 'next-intl'
import { BusinessSectionsEditor } from '@/components/features/business-sections-editor'

/**
 * Admin tab for managing ordered Business page sections (hero, bands, topics).
 *
 * @returns Business sections administration page.
 */
export default function EditorBusinessPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('businessPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('businessPage.subtitle')}</p>
      <BusinessSectionsEditor />
    </div>
  )
}
