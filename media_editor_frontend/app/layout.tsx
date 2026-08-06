import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'NewsCore Media Editor',
  description: 'Independent newsroom media editing workspace',
}

interface IRootLayoutProps {
  children: ReactNode
}

/** Render the independent media-editor application shell. */
export default function RootLayout({ children }: IRootLayoutProps): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
