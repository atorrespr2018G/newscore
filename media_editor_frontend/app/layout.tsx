import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Libre_Franklin, Source_Serif_4 } from 'next/font/google'
import './globals.css'

export const metadata: Metadata = {
  title: 'NewsCore Media Desk',
  description: 'Newsroom media editing workspace',
}

const sans = Libre_Franklin({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

interface IRootLayoutProps {
  children: ReactNode
}

/** Render the independent media-editor application shell. */
export default function RootLayout({ children }: IRootLayoutProps): JSX.Element {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  )
}
