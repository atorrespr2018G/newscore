'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  DEFAULT_LOCALE,
  isValidLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  type AppLocale,
} from '@/i18n/config'
import { updateProfileLocale } from '@/lib/api/auth'

interface ILocaleContextValue {
  locale: AppLocale
  setLocale: (code: string) => void
}

const LocaleContext = createContext<ILocaleContextValue | null>(null)

function readStoredLocale(fallback: AppLocale): AppLocale {
  if (typeof window === 'undefined') {
    return fallback
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isValidLocale(stored)) {
    return stored
  }

  return fallback
}

interface ILocaleProviderProps {
  children: ReactNode
  initialLocale: AppLocale
}

/**
 * Active UI language. Persisted in localStorage and cookie; independent from market.
 */
export function LocaleProvider({ children, initialLocale }: ILocaleProviderProps): JSX.Element {
  const router = useRouter()
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale)

  useEffect(() => {
    setLocaleState(readStoredLocale(initialLocale))
  }, [initialLocale])

  const setLocale = useCallback(
    (code: string) => {
      const normalized = code.trim().toLowerCase()
      if (!isValidLocale(normalized)) {
        return
      }

      setLocaleState(normalized)
      window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized)
      document.cookie = `${LOCALE_COOKIE_NAME}=${normalized};path=/;max-age=31536000;samesite=lax`
      void updateProfileLocale(normalized)
      router.refresh()
    },
    [router],
  )

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): ILocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}

export { DEFAULT_LOCALE, type AppLocale }
