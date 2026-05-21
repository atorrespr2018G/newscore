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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

