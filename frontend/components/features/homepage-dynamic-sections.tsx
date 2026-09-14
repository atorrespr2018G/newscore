'use client'

import dynamic from 'next/dynamic'
import { SectionSkeleton } from '@/components/ui/feed-state'

/** Lazy editorial three-column band used on the main homepage walk. */
export const HomepageEditorialBand = dynamic(
  () => import('@/components/features/homepage-editorial-band').then((m) => m.HomepageEditorialBand),
  { loading: () => <SectionSkeleton /> },
)

/** Lazy US / featured band used on homepage and sports-style pages. */
export const HomepageUsBand = dynamic(
  () => import('@/components/features/homepage-us-band').then((m) => m.HomepageUsBand),
  { loading: () => <SectionSkeleton /> },
)

/** Lazy compact / grid section used across homepage-format pages. */
export const HomepageSection = dynamic(
  () => import('@/components/features/homepage-section').then((m) => m.HomepageSection),
  { loading: () => <SectionSkeleton /> },
)

/** Lazy live / health carousel used on homepage and sports-style pages. */
export const HealthCarouselSection = dynamic(
  () =>
    import('@/components/features/homepage-health-carousel').then((m) => m.HealthCarouselSection),
  { loading: () => <SectionSkeleton /> },
)
