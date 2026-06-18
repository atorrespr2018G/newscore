import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { isValidLocale } from '@/i18n/config'
import { routing } from '@/i18n/routing'

interface ILocaleLayoutProps {
  children: ReactNode
  params: { locale: string }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default function LocaleLayout({ children, params: { locale } }: ILocaleLayoutProps): JSX.Element {
  if (!isValidLocale(locale)) {
    notFound()
  }

  setRequestLocale(locale)

  return <>{children}</>
}
