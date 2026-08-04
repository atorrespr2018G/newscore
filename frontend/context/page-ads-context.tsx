'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { AdSlotVariant } from '@/lib/ad-config'
import type { IPageAdPlacement, PageAdLocation } from '@/lib/helpers/page-ad-placements'
import {
  findAdPlacement,
  resolveAdVariant,
  shouldRenderConfiguredAd,
} from '@/lib/helpers/page-ad-placements'

interface IPageAdsContextValue {
  placements: IPageAdPlacement[]
  setPlacements: (placements: IPageAdPlacement[]) => void
  shouldRender: (location: PageAdLocation, anchorSlug?: string | null) => boolean
  variantFor: (
    location: PageAdLocation,
    fallback: AdSlotVariant,
    anchorSlug?: string | null,
  ) => AdSlotVariant
}

const PageAdsContext = createContext<IPageAdsContextValue | null>(null)

interface IPageAdsProviderProps {
  children: ReactNode
}

/**
 * Site-level page ad placements shared by masthead and page bodies.
 */
export function PageAdsProvider({ children }: IPageAdsProviderProps): JSX.Element {
  const [placements, setPlacementsState] = useState<IPageAdPlacement[]>([])
  const setPlacements = useCallback((next: IPageAdPlacement[]) => {
    setPlacementsState(next)
  }, [])

  const value = useMemo<IPageAdsContextValue>(() => {
    return {
      placements,
      setPlacements,
      shouldRender: (location, anchorSlug) =>
        shouldRenderConfiguredAd(placements, location, anchorSlug),
      variantFor: (location, fallback, anchorSlug) =>
        resolveAdVariant(findAdPlacement(placements, location, anchorSlug), fallback),
    }
  }, [placements, setPlacements])

  return <PageAdsContext.Provider value={value}>{children}</PageAdsContext.Provider>
}

/**
 * Read page ad placement helpers. Outside a provider, ads stay always-on.
 *
 * @returns Page ads context value.
 */
export function usePageAds(): IPageAdsContextValue {
  return (
    useContext(PageAdsContext) ?? {
      placements: [],
      setPlacements: () => undefined,
      shouldRender: () => true,
      variantFor: (_location, fallback) => fallback,
    }
  )
}

/**
 * Sync feed ad placements into the site-level PageAdsProvider.
 *
 * @param placements - Ad placements from the active page feed.
 */
export function useSyncPageAdPlacements(placements: IPageAdPlacement[] | undefined): void {
  const { setPlacements } = usePageAds()
  useEffect(() => {
    setPlacements(placements ?? [])
    return () => setPlacements([])
  }, [placements, setPlacements])
}
