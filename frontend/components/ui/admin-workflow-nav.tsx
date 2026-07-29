'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useWorkflowBadges } from '@/hooks/use-workflow-badges'
import {
  ADMIN_WORKFLOW_TABS,
  isAdminWorkflowGroupTab,
  type AdminWorkflowTabType,
  type IAdminWorkflowLeafTab,
} from '@/lib/api/admin-routes'

/** Sticky offset below the fixed masthead nav bar (~48px). */
const SIDE_NAV_STICKY_TOP_CLASS = 'top-12'

interface IAdminWorkflowSideNavLinkProps {
  href: string
  label: string
  active: boolean
  badgeCount?: number
  badgeLabel?: string
  layout: 'vertical' | 'horizontal'
  nested?: boolean
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
  nested = false,
}: IAdminWorkflowSideNavLinkProps): JSX.Element {
  const isVertical = layout === 'vertical'

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'inline-flex items-center gap-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)] focus-visible:ring-offset-2',
        isVertical ? 'w-full rounded-sm px-3 py-2 text-sm' : 'shrink-0 rounded-sm px-3 py-2 text-sm',
        nested && isVertical ? 'pl-6 text-[13px] font-medium' : '',
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

interface IAdminWorkflowGroupProps {
  tab: Extract<AdminWorkflowTabType, { children: ReadonlyArray<IAdminWorkflowLeafTab> }>
  pathname: string
  layout: 'vertical' | 'horizontal'
}

interface IAdminWorkflowGroupToggleProps {
  label: string
  open: boolean
  childActive: boolean
  layout: 'vertical' | 'horizontal'
  onToggle: () => void
}

/**
 * Render the expand/collapse control for a nested workflow group.
 *
 * @param props Label, open state, child-active styling, layout, and toggle handler.
 * @returns Button that reveals or hides nested workflow links.
 */
function AdminWorkflowGroupToggle({
  label,
  open,
  childActive,
  layout,
  onToggle,
}: IAdminWorkflowGroupToggleProps): JSX.Element {
  const isVertical = layout === 'vertical'

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={[
        'inline-flex items-center gap-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)] focus-visible:ring-offset-2',
        isVertical ? 'w-full rounded-sm px-3 py-2 text-sm' : 'shrink-0 rounded-sm px-3 py-2 text-sm',
        childActive ? 'text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100',
      ].join(' ')}
    >
      <span className="flex-1 text-left">{label}</span>
      <span aria-hidden className={['text-[10px] leading-none transition-transform', open ? 'rotate-180' : ''].join(' ')}>
        ▼
      </span>
    </button>
  )
}

/**
 * Keep a workflow group open while any child route is active.
 *
 * @param childActive Whether the current pathname matches a child tab.
 * @returns Open state and a toggle handler.
 */
function useWorkflowGroupOpen(childActive: boolean): { open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(childActive)

  useEffect(() => {
    if (childActive) {
      setOpen(true)
    }
  }, [childActive])

  return { open, toggle: () => setOpen((prev) => !prev) }
}

/**
 * Expandable Configuration-style group with nested workflow links.
 *
 * Opens when the user toggles it, and stays open while a child route is active
 * so nested destinations remain visible during navigation.
 *
 * @param props Group tab config, pathname, and layout variant.
 * @returns Parent toggle plus nested child links when expanded.
 */
function AdminWorkflowGroup({ tab, pathname, layout }: IAdminWorkflowGroupProps): JSX.Element {
  const tAdmin = useTranslations('admin')
  const childActive = tab.children.some((child) => pathname.startsWith(child.activePrefix))
  const { open, toggle } = useWorkflowGroupOpen(childActive)
  const isVertical = layout === 'vertical'

  return (
    <div className={isVertical ? 'flex w-full flex-col gap-1' : 'flex shrink-0 items-center gap-1'}>
      <AdminWorkflowGroupToggle
        label={tAdmin(`workflow.${tab.labelKey}`)}
        open={open}
        childActive={childActive}
        layout={layout}
        onToggle={toggle}
      />
      {open ? <AdminWorkflowGroupChildren items={tab.children} pathname={pathname} layout={layout} /> : null}
    </div>
  )
}

interface IAdminWorkflowGroupChildrenProps {
  items: ReadonlyArray<IAdminWorkflowLeafTab>
  pathname: string
  layout: 'vertical' | 'horizontal'
}

/**
 * Render nested leaf links inside an expanded workflow group.
 *
 * @param props Child tab configs, pathname, and layout variant.
 * @returns Nested workflow navigation links.
 */
function AdminWorkflowGroupChildren({
  items,
  pathname,
  layout,
}: IAdminWorkflowGroupChildrenProps): JSX.Element {
  const tAdmin = useTranslations('admin')
  const tNav = useTranslations('navigation')
  const badges = useWorkflowBadges()

  return (
    <>
      {items.map((child) => {
        const badgeCount = child.badgeView ? badges[child.badgeView] : 0
        return (
          <AdminWorkflowSideNavLink
            key={child.href}
            href={child.href}
            label={tAdmin(`workflow.${child.labelKey}`)}
            active={pathname.startsWith(child.activePrefix)}
            badgeCount={badgeCount}
            badgeLabel={badgeCount > 0 ? tNav('newItemsBadge', { count: badgeCount }) : undefined}
            layout={layout}
            nested
          />
        )
      })}
    </>
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
 * @returns Mapped workflow navigation links and expandable groups.
 */
function AdminWorkflowSideNavList({ pathname, layout }: IAdminWorkflowSideNavListProps): JSX.Element {
  const tAdmin = useTranslations('admin')
  const tNav = useTranslations('navigation')
  const badges = useWorkflowBadges()

  return (
    <>
      {ADMIN_WORKFLOW_TABS.map((tab) => {
        if (isAdminWorkflowGroupTab(tab)) {
          return <AdminWorkflowGroup key={tab.labelKey} tab={tab} pathname={pathname} layout={layout} />
        }

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
 * Vertical side panel navigation for Reporter, Editor, Placement, Configuration, and Preview.
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
