import { getRequestConfig } from 'next-intl/server'

import { resolveLocale } from '@/lib/i18n/locale-resolution'

const NAMESPACES = ['common', 'navigation', 'home', 'auth', 'admin'] as const

// Pin a single editorial time zone so server and client format dates
// identically; without this the server falls back to UTC while the browser
// uses local time, which triggers React hydration mismatches.
const DEFAULT_TIME_ZONE = 'America/New_York'
const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? DEFAULT_TIME_ZONE

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await resolveLocale(await requestLocale)

  const namespaceMessages = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const module = await import(`../messages/${locale}/${namespace}.json`)
      return [namespace, module.default] as const
    }),
  )

  return {
    locale,
    timeZone: TIME_ZONE,
    messages: Object.fromEntries(namespaceMessages),
  }
})
