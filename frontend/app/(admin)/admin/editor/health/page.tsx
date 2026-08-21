'use client'

import { useTranslations } from 'next-intl'
import { HealthSectionsEditor } from '@/components/features/health-sections-editor'

/**
 * Admin tab for managing ordered Health page sections (hero, bands, topics).
 *
 * @returns Health sections administration page.
 */
export default function EditorHealthPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('healthPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('healthPage.subtitle')}</p>
      <HealthSectionsEditor />
    </div>
  )
}
