export const DEFAULT_LOCALE = 'en'

export const LOCALES = ['en', 'es'] as const

export type AppLocale = (typeof LOCALES)[number]

export const LOCALE_COOKIE_NAME = 'newscore_locale'

export const LOCALE_STORAGE_KEY = 'newscore_locale'

export function isValidLocale(value: string | undefined | null): value is AppLocale {
  if (!value) return false
  return LOCALES.includes(value.trim().toLowerCase() as AppLocale)
}
