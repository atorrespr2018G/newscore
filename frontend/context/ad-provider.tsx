'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { getAdsMode, type AdsMode } from '@/lib/ad-config'

interface IAdContextValue {
  mode: AdsMode
}

const AdContext = createContext<IAdContextValue | null>(null)

interface IAdProviderProps {
  children: ReactNode
  /** Optional mode override for tests; defaults to env-driven mode. */
  mode?: AdsMode
}

/**
 * Site-only ads context. Mount under the public `(site)` layout only.
 */
export function AdProvider({ children, mode }: IAdProviderProps): JSX.Element {
  const value = useMemo<IAdContextValue>(() => ({ mode: mode ?? getAdsMode() }), [mode])

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>
}

/**
 * Read the active ads mode from the nearest AdProvider.
 *
 * @returns Ads context value.
 * @throws Error when used outside AdProvider.
 */
export function useAds(): IAdContextValue {
  const context = useContext(AdContext)
  if (!context) {
    throw new Error('useAds must be used within AdProvider')
  }

  return context
}
