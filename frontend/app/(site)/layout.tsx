import type { ReactNode } from 'react'

import { BreakingTicker } from '@/components/features/breaking-ticker'
import { Masthead } from '@/components/ui/masthead'

interface ISiteLayoutProps {
  children: ReactNode
}

/**
 * Shared public-site chrome: masthead and breaking ticker on all pages.
 */
export default function SiteLayout({ children }: ISiteLayoutProps): JSX.Element {
  return (
    <>
      <Masthead />
      <BreakingTicker />
      {children}
    </>
  )
}
