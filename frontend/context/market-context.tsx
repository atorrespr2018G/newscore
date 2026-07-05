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
import {
  isValidPuertoRicoTownCode,
  PUERTO_RICO_MARKET_CODE,
  TOWN_COOKIE_NAME,
  TOWN_STORAGE_KEY,
} from '@/lib/puerto-rico-towns'
import { isValidUsStateCode, US_MARKET_CODE } from '@/lib/us-states'

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

/**
 * Resolve the persisted locality for a market (US state or PR town).
 *
 * @param marketCode Active market code.
 * @returns Stored locality code, PR default town, or null when unscoped.
 */
function readStoredLocalityForMarket(marketCode: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(TOWN_STORAGE_KEY)

  if (marketCode === PUERTO_RICO_MARKET_CODE) {
    if (stored && isValidPuertoRicoTownCode(stored)) {
      return stored
    }
    return null
  }

  if (marketCode === US_MARKET_CODE) {
    if (stored && isValidUsStateCode(stored)) {
      return stored
    }
    return null
  }

  return null
}

function persistTown(townCode: string): void {
  window.localStorage.setItem(TOWN_STORAGE_KEY, townCode)
  document.cookie = `${TOWN_COOKIE_NAME}=${townCode};path=/;max-age=31536000;samesite=lax`
}

function clearPersistedTown(): void {
  window.localStorage.removeItem(TOWN_STORAGE_KEY)
  document.cookie = `${TOWN_COOKIE_NAME}=;path=/;max-age=0;samesite=lax`
}

/**
 * Validate a locality code for the active market.
 *
 * @param marketCode Active market code.
 * @param localityCode Locality slug or null for unscoped feeds.
 * @returns True when the value is allowed for the market.
 */
function isValidLocalityForMarket(marketCode: string, localityCode: string | null): boolean {
  if (localityCode === null) {
    return true
  }

  if (marketCode === PUERTO_RICO_MARKET_CODE) {
    return isValidPuertoRicoTownCode(localityCode)
  }

  if (marketCode === US_MARKET_CODE) {
    return isValidUsStateCode(localityCode)
  }

  return false
}

interface IMarketProviderProps {
  children: ReactNode
}

/**
 * Active news market (country edition). Persisted in localStorage and cookie.
 */
export function MarketProvider({ children }: IMarketProviderProps): JSX.Element {
  const [marketCode, setMarketCodeState] = useState(DEFAULT_MARKET_CODE)
  const [town, setTownState] = useState<string | null>(null)

  useEffect(() => {
    const storedMarket = readStoredMarket()
    setMarketCodeState(storedMarket)
    setTownState(readStoredLocalityForMarket(storedMarket))
  }, [])

  const setMarketCode = useCallback((code: string) => {
    const normalized = code.trim().toLowerCase()
    if (!isValidMarketCode(normalized)) {
      return
    }
    setMarketCodeState(normalized)
    window.localStorage.setItem(MARKET_STORAGE_KEY, normalized)
    document.cookie = `${MARKET_COOKIE_NAME}=${normalized};path=/;max-age=31536000;samesite=lax`

    if (normalized === PUERTO_RICO_MARKET_CODE || normalized === US_MARKET_CODE) {
      const nextTown = readStoredLocalityForMarket(normalized)
      setTownState(nextTown)
      if (nextTown) {
        persistTown(nextTown)
      } else {
        clearPersistedTown()
      }
      return
    }

    setTownState(null)
    clearPersistedTown()
  }, [])

  const setTown = useCallback(
    (townCode: string | null) => {
      if (!isValidLocalityForMarket(marketCode, townCode)) {
        return
      }
      setTownState(townCode)
      if (townCode) {
        persistTown(townCode)
      } else {
        clearPersistedTown()
      }
    },
    [marketCode],
  )

  const value = useMemo(
    () => ({ marketCode, town, setMarketCode, setTown }),
    [marketCode, town, setMarketCode, setTown],
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
