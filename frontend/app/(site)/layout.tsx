import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'

const Masthead = dynamic(() => import('@/components/ui/masthead').then((mod) => mod.Masthead), {
  ssr: false,
})

const BreakingTicker = dynamic(
  () => import('@/components/features/breaking-ticker').then((mod) => mod.BreakingTicker),
  { ssr: false },
)

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
