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

/** Admin workflow routes available from the top nav tabs. */
export const ADMIN_WORKFLOW_ROUTES = [
  '/admin/reporter',
  '/admin/editor/news',
  '/admin/editor/placement',
  '/admin/preview',
] as const

export type AdminWorkflowRouteType = (typeof ADMIN_WORKFLOW_ROUTES)[number]

/**
 * Tab paths and their `admin.workflow.*` message keys for the editorial tab bar.
 *
 * Labels are resolved at render time via `useTranslations` so the bar follows
 * the active UI locale; only the semantic key lives here. `activePrefix` marks a
 * tab active for its own sub-routes only, so News and Placement never both
 * highlight at once even though they share the `/admin/editor` segment.
 */
export const ADMIN_WORKFLOW_TABS: ReadonlyArray<{
  href: AdminWorkflowRouteType
  labelKey: string
  activePrefix: string
}> = [
  { href: '/admin/reporter', labelKey: 'reporter', activePrefix: '/admin/reporter' },
  { href: '/admin/editor/news', labelKey: 'news', activePrefix: '/admin/editor/news' },
  { href: '/admin/editor/placement', labelKey: 'placement', activePrefix: '/admin/editor/placement' },
]

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
