import { getRequestConfig } from 'next-intl/server'

import { resolveLocale } from '@/lib/i18n/locale-resolution'

const NAMESPACES = ['common', 'navigation', 'home', 'auth', 'admin'] as const

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
    messages: Object.fromEntries(namespaceMessages),
  }
})
