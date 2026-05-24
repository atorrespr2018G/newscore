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

import {
  DEFAULT_MARKET_CODE,
  isValidMarketCode,
  MARKET_COOKIE_NAME,
  MARKET_OPTIONS,
  MARKET_STORAGE_KEY,
  type IMarketOption,
} from '@/lib/market-constants'

export { MARKET_OPTIONS, type IMarketOption }

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
  const stored = window.localStorage.getItem(MARKET_STORAGE_KEY)
  if (stored && isValidMarketCode(stored)) {
    return stored
  }
  return DEFAULT_MARKET_CODE
}

interface IMarketProviderProps {
  children: ReactNode
}

/**
 * Active news market (country edition). Persisted in localStorage and cookie.
 */
export function MarketProvider({ children }: IMarketProviderProps): JSX.Element {
  const [marketCode, setMarketCodeState] = useState(DEFAULT_MARKET_CODE)
  const [town, setTown] = useState<string | null>(null)

  useEffect(() => {
    setMarketCodeState(readStoredMarket())
  }, [])

  const setMarketCode = useCallback((code: string) => {
    const normalized = code.trim().toLowerCase()
    if (!isValidMarketCode(normalized)) {
      return
    }
    setMarketCodeState(normalized)
    window.localStorage.setItem(MARKET_STORAGE_KEY, normalized)
    document.cookie = `${MARKET_COOKIE_NAME}=${normalized};path=/;max-age=31536000;samesite=lax`
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
