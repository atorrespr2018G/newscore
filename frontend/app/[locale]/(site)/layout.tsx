import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Footer } from '@/components/ui/footer'

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
 * Shared public-site chrome: masthead, breaking ticker, and footer on all pages.
 */
export default function SiteLayout({ children }: ISiteLayoutProps): JSX.Element {
  return (
    <>
      <Masthead />
      <BreakingTicker />
      {children}
      <Footer />
    </>
  )
}
