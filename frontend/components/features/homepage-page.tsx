'use client'

import { useTranslations } from 'next-intl'
import { HomepageContent } from '@/components/features/homepage-content'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feed-state'
import { useFeed } from '@/hooks/use-feed'
import { usePageFeed } from '@/hooks/use-page-feed'
import type { IHomepageFeed } from '@/interfaces/feed'
import {
  BUSINESS_PAGE_NAME,
  ENTERTAINMENT_PAGE_NAME,
  GOVERNMENT_PAGE_NAME,
  HEALTH_PAGE_NAME,
  SPORTS_PAGE_NAME,
  STYLE_PAGE_NAME,
  TECHNOLOGY_PAGE_NAME,
  TRAVEL_PAGE_NAME,
} from '@/lib/helpers/homepage-page-names'
import { isPublicPageEnabled } from '@/lib/helpers/page-visibility'
import { notFound } from 'next/navigation'

interface IInitialFeedProps {
  initialFeed?: IHomepageFeed
}

/**
 * Shared loading / error / empty handling for homepage-format pages.
 *
 * @param props Feed query state and a render callback for a resolved feed.
 * @returns Loading, error, empty, or the rendered page.
 */
function HomepageFeedShell({
  feedData,
  loading,
  error,
  children,
}: {
  feedData: IHomepageFeed | undefined
  loading: boolean
  error: Error | undefined
  children: (feed: IHomepageFeed) => JSX.Element
}): JSX.Element {
  const t = useTranslations('common')

  if (loading && !feedData) return <LoadingState message={t('loading')} />
  if (error && !feedData) return <ErrorState message={t('failedToLoad', { message: error.message })} />

  if (!feedData || feedData.slots.length === 0) {
    return (
      <EmptyState>
        {t.rich('noStoriesYet', {
          command: () => <code className="text-sm">{t('seedCommand')}</code>,
        })}
      </EmptyState>
    )
  }

  return children(feedData)
}

/**
 * Sports-style landing that loads a named page feed.
 *
 * @param props Page name and optional server-rendered fallback feed.
 * @returns The named homepage-format page.
 */
function NamedHomepagePage({
  pageName,
  initialFeed,
}: {
  pageName: string
  initialFeed?: IHomepageFeed
}): JSX.Element {
  const { data, loading, error } = usePageFeed(pageName)
  const feedData = data ?? initialFeed
  if (feedData && !isPublicPageEnabled(feedData)) {
    notFound()
  }

  return (
    <HomepageFeedShell feedData={feedData} loading={loading} error={error ?? undefined}>
      {(feed) => <HomepageContent feed={feed} options={{ useSportsSectionRows: true }} />}
    </HomepageFeedShell>
  )
}

/**
 * Render the homepage module stack from the active feed.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Homepage component.
 */
export function Homepage({ initialFeed }: IInitialFeedProps): JSX.Element {
  const { data, loading, error } = useFeed()
  const feedData = data ?? initialFeed

  return (
    <HomepageFeedShell feedData={feedData} loading={loading} error={error ?? undefined}>
      {(feed) => <HomepageContent feed={feed} />}
    </HomepageFeedShell>
  )
}

/**
 * Sports page using the landing-page hero/Top Stories plus dynamic sport rows.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Sports page component.
 */
export function SportsPage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={SPORTS_PAGE_NAME} initialFeed={initialFeed} />
}

/**
 * Economía landing using the sports-page hero plus compact beat rows.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Economía page component.
 */
export function BusinessPage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={BUSINESS_PAGE_NAME} initialFeed={initialFeed} />
}

/**
 * Government landing using the sports-page hero plus compact topic rows.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Government page component.
 */
export function GovernmentPage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={GOVERNMENT_PAGE_NAME} initialFeed={initialFeed} />
}

/**
 * Entertainment landing using the sports-page hero plus compact topic rows.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Entertainment page component.
 */
export function EntertainmentPage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={ENTERTAINMENT_PAGE_NAME} initialFeed={initialFeed} />
}

/**
 * Health landing using the sports-page hero plus compact topic rows.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Health page component.
 */
export function HealthPage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={HEALTH_PAGE_NAME} initialFeed={initialFeed} />
}

/**
 * Landing page for an admin-created custom tab (Entertainment/Health template).
 *
 * @param props Page name and optional server feed.
 * @returns Custom tab landing page.
 */
export function CustomTabPage({
  pageName,
  initialFeed,
}: {
  pageName: string
  initialFeed?: IHomepageFeed
}): JSX.Element {
  return <NamedHomepagePage pageName={pageName} initialFeed={initialFeed} />
}

/**
 * Technology landing using the sports-page hero, Top Stories, and Live band.
 * The paginated archive is rendered by the route without a Technology heading.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Technology page component.
 */
export function TechnologyPage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={TECHNOLOGY_PAGE_NAME} initialFeed={initialFeed} />
}

/**
 * Style landing using the sports-page hero, Top Stories, and Live band.
 * The paginated archive is rendered by the route without a Style heading.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Style page component.
 */
export function StylePage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={STYLE_PAGE_NAME} initialFeed={initialFeed} />
}

/**
 * Travel landing using the sports-page hero, Top Stories, and Live band.
 * The paginated archive is rendered by the route without a Travel heading.
 *
 * @param initialFeed Optional server-rendered fallback feed.
 * @returns Travel page component.
 */
export function TravelPage({ initialFeed }: IInitialFeedProps): JSX.Element {
  return <NamedHomepagePage pageName={TRAVEL_PAGE_NAME} initialFeed={initialFeed} />
}
