'use client'

import { useTranslations } from 'next-intl'
import { TechnologySectionsEditor } from '@/components/features/technology-sections-editor'

/**
 * Admin tab for managing ordered Technology page sections (hero, bands, archive).
 *
 * @returns Technology sections administration page.
 */
export default function EditorTechnologyPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('technologyPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('technologyPage.subtitle')}</p>
      <TechnologySectionsEditor />
    </div>
  )
}
