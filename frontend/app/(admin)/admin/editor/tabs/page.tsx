'use client'

import { useTranslations } from 'next-intl'
import { CreateCustomTabForm } from '@/components/features/create-custom-tab-form'

/**
 * Admin page to register a new custom category tab.
 *
 * @returns Create-tab Configuration page.
 */
export default function CreateCustomTabPage(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('customTabs.createHeading')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('customTabs.createSubtitle')}</p>
      <CreateCustomTabForm />
    </div>
  )
}
