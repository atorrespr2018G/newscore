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
import { useRouter } from 'next/navigation'

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
import {
  COUNTY_COOKIE_NAME,
  COUNTY_STORAGE_KEY,
  FLORIDA_STATE_CODE,
  isValidFloridaCountyCode,
  normalizeFloridaCountyCode,
} from '@/lib/florida-counties'
import { isValidUsStateCode, US_MARKET_CODE } from '@/lib/us-states'

export { MARKET_OPTIONS, type IMarketOption }

interface IMarketContextValue {
  marketCode: string
  town: string | null
  county: string | null
  setMarketCode: (code: string) => void
  setTown: (town: string | null) => void
  setCounty: (county: string | null) => void
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

function readStoredCountyForScope(marketCode: string, town: string | null): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  if (marketCode !== US_MARKET_CODE || town !== FLORIDA_STATE_CODE) {
    return null
  }
  const stored = window.localStorage.getItem(COUNTY_STORAGE_KEY)
  if (stored) {
    const normalized = normalizeFloridaCountyCode(stored)
    if (isValidFloridaCountyCode(normalized)) {
      return normalized
    }
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

function persistCounty(countyCode: string): void {
  const normalized = normalizeFloridaCountyCode(countyCode)
  window.localStorage.setItem(COUNTY_STORAGE_KEY, normalized)
  document.cookie = `${COUNTY_COOKIE_NAME}=${normalized};path=/;max-age=31536000;samesite=lax`
}

function clearPersistedCounty(): void {
  window.localStorage.removeItem(COUNTY_STORAGE_KEY)
  document.cookie = `${COUNTY_COOKIE_NAME}=;path=/;max-age=0;samesite=lax`
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

function isValidCountyForScope(
  marketCode: string,
  localityCode: string | null,
  countyCode: string | null,
): boolean {
  if (countyCode === null) {
    return true
  }
  if (marketCode !== US_MARKET_CODE || localityCode !== FLORIDA_STATE_CODE) {
    return false
  }
  return isValidFloridaCountyCode(countyCode)
}

interface IMarketProviderProps {
  children: ReactNode
}

/**
 * Active news market (country edition). Persisted in localStorage and cookie.
 */
export function MarketProvider({ children }: IMarketProviderProps): JSX.Element {
  const router = useRouter()
  const [marketCode, setMarketCodeState] = useState(DEFAULT_MARKET_CODE)
  const [town, setTownState] = useState<string | null>(null)
  const [county, setCountyState] = useState<string | null>(null)

  useEffect(() => {
    const storedMarket = readStoredMarket()
    const storedTown = readStoredLocalityForMarket(storedMarket)
    setMarketCodeState(storedMarket)
    setTownState(storedTown)
    setCountyState(readStoredCountyForScope(storedMarket, storedTown))
  }, [])

  const setMarketCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toLowerCase()
      if (!isValidMarketCode(normalized) || normalized === marketCode) {
        return
      }
      setMarketCodeState(normalized)
      window.localStorage.setItem(MARKET_STORAGE_KEY, normalized)
      document.cookie = `${MARKET_COOKIE_NAME}=${normalized};path=/;max-age=31536000;samesite=lax`

      if (normalized === PUERTO_RICO_MARKET_CODE || normalized === US_MARKET_CODE) {
        const nextTown = readStoredLocalityForMarket(normalized)
        setTownState(nextTown)
        const nextCounty = readStoredCountyForScope(normalized, nextTown)
        setCountyState(nextCounty)
        if (nextTown) {
          persistTown(nextTown)
        } else {
          clearPersistedTown()
        }
        if (nextCounty) {
          persistCounty(nextCounty)
        } else {
          clearPersistedCounty()
        }
      } else {
        setTownState(null)
        setCountyState(null)
        clearPersistedTown()
        clearPersistedCounty()
      }

      router.refresh()
    },
    [marketCode, router],
  )

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
      const shouldKeepCounty = marketCode === US_MARKET_CODE && townCode === FLORIDA_STATE_CODE
      if (!shouldKeepCounty) {
        setCountyState(null)
        clearPersistedCounty()
      } else {
        const restoredCounty = readStoredCountyForScope(marketCode, townCode)
        setCountyState(restoredCounty)
        if (restoredCounty) {
          persistCounty(restoredCounty)
        }
      }
      router.refresh()
    },
    [marketCode, router],
  )

  const setCounty = useCallback(
    (countyCode: string | null) => {
      const normalizedCounty = countyCode ? normalizeFloridaCountyCode(countyCode) : null
      if (!isValidCountyForScope(marketCode, town, normalizedCounty)) {
        return
      }
      setCountyState(normalizedCounty)
      if (normalizedCounty) {
        persistCounty(normalizedCounty)
      } else {
        clearPersistedCounty()
      }
      router.refresh()
    },
    [marketCode, router, town],
  )

  const value = useMemo(
    () => ({ marketCode, town, county, setMarketCode, setTown, setCounty }),
    [county, marketCode, town, setCounty, setMarketCode, setTown],
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
