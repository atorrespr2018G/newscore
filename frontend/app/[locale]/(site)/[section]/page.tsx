import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomTabPage } from '@/components/features/homepage'
import { listCustomTabs } from '@/lib/api/layout-client'
import { fetchPageFeed } from '@/lib/graphql/server-fetch'
import { getServerMarketScope } from '@/lib/market-server'

interface ICustomSectionPageProps {
  params: { section: string }
}

/**
 * Resolve a registered custom tab for the active market and section route.
 *
 * @param section URL segment.
 * @returns Matching tab for the current market, or null when unknown.
 */
async function resolveCustomTab(section: string) {
  const slug = decodeURIComponent(section).trim().toLowerCase()
  if (!slug) {
    return null
  }
  const scope = getServerMarketScope()
  const tabs = await listCustomTabs(scope.marketCode).catch(() => [])
  return tabs.find((tab) => tab.slug === slug) ?? null
}

/**
 * Document title for a custom tab landing page.
 *
 * @param props Route params with the section slug.
 * @returns Metadata for `/{section}`.
 */
export async function generateMetadata({
  params,
}: ICustomSectionPageProps): Promise<Metadata> {
  const tab = await resolveCustomTab(params.section)
  if (!tab) {
    return { title: 'NewsCore' }
  }
  return {
    title: `NewsCore — ${tab.label}`,
    description: tab.label,
  }
}

/**
 * Public custom tab landing: Sports-page hero plus compact topic rows.
 *
 * @param props Route params with the section slug.
 * @returns Custom tab page, or 404 when the slug is not registered.
 */
export default async function CustomSectionRoutePage({
  params,
}: ICustomSectionPageProps): Promise<JSX.Element> {
  const tab = await resolveCustomTab(params.section)
  if (!tab) {
    notFound()
  }
  const scope = getServerMarketScope()
  const initialFeed = await fetchPageFeed(
    scope.marketCode,
    tab.slug,
    scope.town,
    scope.county,
  )

  return (
    <main id="main-content" className="site-container py-8">
      <CustomTabPage pageName={tab.slug} initialFeed={initialFeed} />
    </main>
  )
}
