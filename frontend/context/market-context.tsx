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

export interface IMarketOption {
  code: string
  label: string
}

export const MARKET_OPTIONS: IMarketOption[] = [
  { code: 'us', label: 'USA' },
  { code: 'co', label: 'Colombia' },
]

const STORAGE_KEY = 'newscore_market'
const DEFAULT_MARKET_CODE = 'us'

interface IMarketContextValue {
  marketCode: string
  town: string | null
  setMarketCode: (code: string) => void
  setTown: (town: string | null) => void
}

const MarketContext = createContext<IMarketContextValue | null>(null)

function readStoredMarket(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_MARKET_CODE
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored && MARKET_OPTIONS.some((m) => m.code === stored)) {
    return stored
  }
  return DEFAULT_MARKET_CODE
}

interface IMarketProviderProps {
  children: ReactNode
}

/**
 * Active news market (country edition). Persisted in localStorage.
 */
export function MarketProvider({ children }: IMarketProviderProps): JSX.Element {
  const [marketCode, setMarketCodeState] = useState(DEFAULT_MARKET_CODE)
  const [town, setTown] = useState<string | null>(null)

  useEffect(() => {
    setMarketCodeState(readStoredMarket())
  }, [])

  const setMarketCode = useCallback((code: string) => {
    const normalized = code.trim().toLowerCase()
    if (!MARKET_OPTIONS.some((m) => m.code === normalized)) {
      return
    }
    setMarketCodeState(normalized)
    window.localStorage.setItem(STORAGE_KEY, normalized)
  }, [])

  const value = useMemo(
    () => ({ marketCode, town, setMarketCode, setTown }),
    [marketCode, town, setMarketCode],
  )

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket(): IMarketContextValue {
  const ctx = useContext(MarketContext)
  if (!ctx) {
    throw new Error('useMarket must be used within MarketProvider')
  }
  return ctx
}
