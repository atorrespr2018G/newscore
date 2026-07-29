'use client'

import { useTranslations } from 'next-intl'
import { MainPageSectionsEditor } from '@/components/features/main-page-sections-editor'

/**
 * Admin tab for managing ordered Main Page sections (hero, bands, categories).
 *
 * @returns Main-page sections administration page.
 */
export default function EditorMainPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('mainPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('mainPage.subtitle')}</p>
      <MainPageSectionsEditor />
    </div>
  )
}
