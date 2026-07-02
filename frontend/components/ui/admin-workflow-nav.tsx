'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useWorkflowBadges } from '@/hooks/use-workflow-badges'
import { ADMIN_WORKFLOW_TABS } from '@/lib/api/admin-routes'

/** Sticky offset below the fixed masthead nav bar (~48px). */
const SIDE_NAV_STICKY_TOP_CLASS = 'top-12'

interface IAdminWorkflowSideNavLinkProps {
  href: string
  label: string
  active: boolean
  badgeCount?: number
  badgeLabel?: string
  layout: 'vertical' | 'horizontal'
}

/**
 * Render a single workflow tab link for the admin side panel.
 *
 * @param props Link target, label, active state, optional badge, and layout variant.
 * @returns Localized workflow navigation link.
 */
function AdminWorkflowSideNavLink({
  href,
  label,
  active,
  badgeCount = 0,
  badgeLabel,
  layout,
}: IAdminWorkflowSideNavLinkProps): JSX.Element {
  const isVertical = layout === 'vertical'

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'inline-flex items-center gap-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)] focus-visible:ring-offset-2',
        isVertical ? 'w-full rounded-sm px-3 py-2 text-sm' : 'shrink-0 rounded-sm px-3 py-2 text-sm',
        active
          ? 'bg-[color:var(--brand-red)] text-white'
          : 'text-neutral-700 hover:bg-neutral-100',
      ].join(' ')}
    >
      {label}
      {badgeCount > 0 ? (
        <span
          aria-label={badgeLabel}
          className={[
            'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-4',
            active ? 'bg-white text-[color:var(--brand-red)]' : 'bg-[color:var(--brand-red)] text-white',
          ].join(' ')}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      ) : null}
    </Link>
  )
}

interface IAdminWorkflowSideNavListProps {
  pathname: string
  layout: 'vertical' | 'horizontal'
}

/**
 * Render the workflow tab list shared by desktop sidebar and mobile strip layouts.
 *
 * @param props Current pathname and layout variant.
 * @returns Mapped workflow navigation links.
 */
function AdminWorkflowSideNavList({ pathname, layout }: IAdminWorkflowSideNavListProps): JSX.Element {
  const tAdmin = useTranslations('admin')
  const tNav = useTranslations('navigation')
  const badges = useWorkflowBadges()

  return (
    <>
      {ADMIN_WORKFLOW_TABS.map((tab) => {
        const badgeCount = tab.badgeView ? badges[tab.badgeView] : 0

        return (
          <AdminWorkflowSideNavLink
            key={tab.href}
            href={tab.href}
            label={tAdmin(`workflow.${tab.labelKey}`)}
            active={pathname.startsWith(tab.activePrefix)}
            badgeCount={badgeCount}
            badgeLabel={badgeCount > 0 ? tNav('newItemsBadge', { count: badgeCount }) : undefined}
            layout={layout}
          />
        )
      })}
    </>
  )
}

/**
 * Vertical side panel navigation for Reporter, Editor, Placement, and Preview.
 *
 * @returns Localized workflow side nav with a mobile-friendly horizontal strip.
 */
export function AdminWorkflowSideNav(): JSX.Element {
  const pathname = usePathname()
  const tAdmin = useTranslations('admin')

  return (
    <>
      <nav
        aria-label={tAdmin('workflow.ariaLabel')}
        className={[
          'sticky z-30 flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white pb-4 md:hidden',
          SIDE_NAV_STICKY_TOP_CLASS,
        ].join(' ')}
      >
        <AdminWorkflowSideNavList pathname={pathname} layout="horizontal" />
      </nav>

      <aside
        className={['sticky hidden w-48 shrink-0 self-start md:block', SIDE_NAV_STICKY_TOP_CLASS].join(' ')}
      >
        <nav aria-label={tAdmin('workflow.ariaLabel')} className="flex flex-col gap-1">
          <AdminWorkflowSideNavList pathname={pathname} layout="vertical" />
        </nav>
      </aside>
    </>
  )
}
