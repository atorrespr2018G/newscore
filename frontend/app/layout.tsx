import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'
import { Libre_Franklin, Merriweather } from 'next/font/google'
import { getLocale, getMessages, getTranslations } from '@/lib/locale-server'
import { isValidLocale, type AppLocale } from '@/i18n/config'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')

  return {
    title: t('meta.appTitle'),
    description: t('meta.appDescription'),
  }
}

const sans = Libre_Franklin({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const serif = Merriweather({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '400', '700', '900'],
  display: 'swap',
})

interface IRootLayoutProps {
  children: ReactNode
}

export default async function RootLayout({ children }: IRootLayoutProps): Promise<JSX.Element> {
  const locale = await getLocale()
  const messages = await getMessages()
  const t = await getTranslations('common')
  const appLocale: AppLocale = isValidLocale(locale) ? locale : 'en'

  return (
    <html lang={appLocale}>
      <body className={`${sans.variable} ${serif.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          {t('skipToMain')}
        </a>
        <Providers locale={appLocale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
