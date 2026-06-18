import { cookies, headers } from 'next/headers'

import { DEFAULT_LOCALE, isValidLocale, LOCALE_COOKIE_NAME, LOCALES, type AppLocale } from '@/i18n/config'
import { getProfileLocalePreference } from '@/lib/api/auth'

function matchAcceptLanguage(
  acceptLanguage: string,
  locales: readonly AppLocale[],
  defaultLocale: AppLocale,
): AppLocale {
  const preferences = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, qPart] = part.trim().split(';q=')
      const q = qPart ? Number.parseFloat(qPart) : 1
      return { lang: lang.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { lang } of preferences) {
    const exact = locales.find((locale) => locale.toLowerCase() === lang)
    if (exact) return exact

    const prefix = lang.split('-')[0]
    const partial = locales.find((locale) => locale.toLowerCase() === prefix)
    if (partial) return partial
  }

  return defaultLocale
}

/**
 * Resolve the active UI locale: profile -> cookie -> browser -> request -> default.
 */
export async function resolveLocale(requestLocale?: string | null): Promise<AppLocale> {
  const profileLocale = await getProfileLocalePreference()
  if (isValidLocale(profileLocale)) {
    return profileLocale
  }

  const cookieLocale = cookies().get(LOCALE_COOKIE_NAME)?.value
  if (isValidLocale(cookieLocale)) {
    return cookieLocale
  }

  const acceptLanguage = headers().get('accept-language')
  if (acceptLanguage) {
    return matchAcceptLanguage(acceptLanguage, LOCALES, DEFAULT_LOCALE)
  }

  if (isValidLocale(requestLocale)) {
    return requestLocale
  }

  return DEFAULT_LOCALE
}
