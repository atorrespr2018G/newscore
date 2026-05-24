const adminBase =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:5001'
const newsBase =
  process.env.NEXT_PUBLIC_NEWS_API_URL ?? 'http://localhost:5002'
const layoutBase =
  process.env.NEXT_PUBLIC_LAYOUT_API_URL ?? 'http://localhost:5003'

/** REST API base URLs (prefer /api/v1/* via Nginx in production). */
export const apiConfig = {
  admin: adminBase.replace(/\/$/, ''),
  news: newsBase.replace(/\/$/, ''),
  layout: layoutBase.replace(/\/$/, ''),
} as const
