'use client'

import { useTranslations } from 'next-intl'
import { SportsSectionsEditor } from '@/components/features/sports-sections-editor'

/**
 * Admin tab for managing per-country sports section rows on the Sports page.
 *
 * @returns Sports sections administration page.
 */
export default function EditorSportsPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('sportsPage.heading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('sportsPage.subtitle')}</p>
      <SportsSectionsEditor />
    </div>
  )
}
