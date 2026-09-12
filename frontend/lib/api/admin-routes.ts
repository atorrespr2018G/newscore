import { getStoredToken } from '@/lib/api/auth'
import { AdminRoleType, decodeJwtPayload } from '@/lib/helpers/jwt'

/**
 * Read the current admin role from the stored JWT.
 *
 * @returns Role claim or null when unavailable.
 */
export function getStoredRole(): AdminRoleType | null {
  const token = getStoredToken()
  if (!token) {
    return null
  }
  return decodeJwtPayload(token)?.role ?? null
}

/**
 * Resolve the default admin landing route for a role.
 *
 * @param role Authenticated admin role.
 * @returns Route path for post-login redirect.
 */
export function getDefaultAdminRoute(role: AdminRoleType): string {
  if (role === 'editor') {
    return '/admin/editor'
  }
  if (role === 'reporter' || role === 'admin') {
    return '/admin/reporter'
  }
  return '/admin/login'
}

/** Masthead entry point for the editorial admin app. */
export const ADMINISTRATOR_ROUTE = '/admin'

/** Admin workflow routes available from the side panel tabs. */
export const ADMIN_WORKFLOW_ROUTES = [
  '/admin/reporter',
  '/admin/editor/news',
  '/admin/editor/placement',
  '/admin/editor/main-page',
  '/admin/editor/world',
  '/admin/editor/sports',
  '/admin/editor/government',
  '/admin/editor/entertainment',
  '/admin/editor/health',
  '/admin/editor/technology',
  '/admin/editor/tabs',
  '/admin/preview',
] as const

export type AdminWorkflowRouteType = (typeof ADMIN_WORKFLOW_ROUTES)[number]

export type AdminWorkflowBadgeViewType = 'placement' | 'review'

/** Leaf workflow tab that navigates to a route. */
export interface IAdminWorkflowLeafTab {
  href: string
  labelKey?: string
  /** When set, shown instead of translating `labelKey` (custom tab names). */
  label?: string
  activePrefix: string
  badgeView?: AdminWorkflowBadgeViewType
}

/**
 * Top-level workflow entry: either a direct link or a parent with nested children.
 *
 * Parent groups (e.g. Configuration) expand in the side nav; children are the
 * navigable destinations. Add future page-config routes under `children`.
 */
export type AdminWorkflowTabType =
  | IAdminWorkflowLeafTab
  | {
      labelKey: string
      children: ReadonlyArray<IAdminWorkflowLeafTab>
    }

/**
 * Tab paths and their `admin.workflow.*` message keys for the editorial side panel.
 *
 * Labels are resolved at render time via `useTranslations` so the bar follows
 * the active UI locale; only the semantic key lives here. `activePrefix` marks a
 * tab active for its own sub-routes only, so Editor and Placement never both
 * highlight at once even though they share the `/admin/editor` segment.
 */
export const ADMIN_WORKFLOW_TABS: ReadonlyArray<AdminWorkflowTabType> = [
  { href: '/admin/reporter', labelKey: 'reporter', activePrefix: '/admin/reporter' },
  { href: '/admin/editor/news', labelKey: 'editor', activePrefix: '/admin/editor/news' },
  { href: '/admin/editor/placement', labelKey: 'placement', activePrefix: '/admin/editor/placement', badgeView: 'placement' },
  {
    labelKey: 'configuration',
    children: [
      { href: '/admin/editor/main-page', labelKey: 'mainPage', activePrefix: '/admin/editor/main-page' },
      { href: '/admin/editor/world', labelKey: 'world', activePrefix: '/admin/editor/world' },
      { href: '/admin/editor/sports', labelKey: 'sports', activePrefix: '/admin/editor/sports' },
      { href: '/admin/editor/government', labelKey: 'government', activePrefix: '/admin/editor/government' },
      { href: '/admin/editor/entertainment', labelKey: 'entertainment', activePrefix: '/admin/editor/entertainment' },
      { href: '/admin/editor/health', labelKey: 'health', activePrefix: '/admin/editor/health' },
      { href: '/admin/editor/technology', labelKey: 'technology', activePrefix: '/admin/editor/technology' },
      { href: '/admin/editor/tabs', labelKey: 'createTab', activePrefix: '/admin/editor/tabs' },
    ],
  },
  { href: '/admin/preview', labelKey: 'preview', activePrefix: '/admin/preview', badgeView: 'review' },
]

/**
 * Whether a workflow tab is a parent group with nested children.
 *
 * @param tab Workflow tab entry.
 * @returns True when the tab exposes a children array.
 */
export function isAdminWorkflowGroupTab(
  tab: AdminWorkflowTabType,
): tab is Extract<AdminWorkflowTabType, { children: ReadonlyArray<IAdminWorkflowLeafTab> }> {
  return 'children' in tab
}

/**
 * Determine whether a role may access an admin pathname.
 *
 * Phase-1 dev convenience: reporter and editor tabs are open to all editorial roles.
 *
 * @param role Authenticated admin role.
 * @param pathname Current admin pathname.
 * @returns True when the route is allowed for the role.
 */
export function canAccessAdminPath(role: AdminRoleType, pathname: string): boolean {
  if (role === 'admin') {
    return true
  }
  if (role === 'reporter' || role === 'editor') {
    return (
      pathname === '/admin' ||
      pathname.startsWith('/admin/reporter') ||
      pathname.startsWith('/admin/editor') ||
      pathname.startsWith('/admin/preview')
    )
  }
  return false
}
