'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ADMIN_WORKFLOW_TABS } from '@/lib/api/admin-routes'

/**
 * Tab navigation for the Reporter, Editor, and Review workflow pages.
 *
 * @returns Localized workflow tab bar, or null on non-workflow admin routes.
 */
export function AdminWorkflowNav(): JSX.Element | null {
  const pathname = usePathname()
  const t = useTranslations('admin')

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/preview')) {
    return null
  }

  return (
    <nav
      aria-label={t('workflow.ariaLabel')}
      className="mb-6 flex flex-wrap gap-2 border-b border-neutral-200 pb-4"
    >
      {ADMIN_WORKFLOW_TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'rounded px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
              isActive
                ? 'bg-brand text-white'
                : 'text-neutral-700 hover:bg-neutral-100',
            ].join(' ')}
          >
            {t(`workflow.${tab.labelKey}`)}
          </Link>
        )
      })}
    </nav>
  )
}
