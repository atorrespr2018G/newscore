import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'
import { Libre_Franklin, Merriweather } from 'next/font/google'

export const metadata = {
  title: 'NewsCore',
  description: 'News platform',
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

export default function RootLayout({ children }: IRootLayoutProps): JSX.Element {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
