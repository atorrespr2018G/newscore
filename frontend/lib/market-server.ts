import { cookies } from 'next/headers'

import {
  DEFAULT_MARKET_CODE,
  isValidMarketCode,
  MARKET_COOKIE_NAME,
} from '@/lib/market-constants'
import {
  COUNTY_COOKIE_NAME,
  FLORIDA_STATE_CODE,
  isValidFloridaCountyCode,
  normalizeFloridaCountyCode,
} from '@/lib/florida-counties'
import {
  isValidPuertoRicoTownCode,
  PUERTO_RICO_MARKET_CODE,
  TOWN_COOKIE_NAME,
} from '@/lib/puerto-rico-towns'
import { isValidUsStateCode, US_MARKET_CODE } from '@/lib/us-states'

export interface IServerMarketScope {
  marketCode: string
  town: string | null
  county: string | null
}

/**
 * Read active market from cookie for server components (SSR).
 */
export function getServerMarketCode(): string {
  const value = cookies().get(MARKET_COOKIE_NAME)?.value?.trim().toLowerCase()
  if (value && isValidMarketCode(value)) {
    return value
  }
  return DEFAULT_MARKET_CODE
}

/**
 * Read active locality from cookie for server components (SSR).
 */
export function getServerTownCode(marketCode: string): string | null {
  const value = cookies().get(TOWN_COOKIE_NAME)?.value?.trim().toLowerCase()
  if (!value) {
    return null
  }
  if (marketCode === US_MARKET_CODE && isValidUsStateCode(value)) {
    return value
  }
  if (marketCode === PUERTO_RICO_MARKET_CODE && isValidPuertoRicoTownCode(value)) {
    return value
  }
  return null
}

/**
 * Read active county from cookie for server components (SSR).
 */
export function getServerCountyCode(marketCode: string, town: string | null): string | null {
  if (marketCode !== US_MARKET_CODE || town !== FLORIDA_STATE_CODE) {
    return null
  }
  const value = cookies().get(COUNTY_COOKIE_NAME)?.value?.trim().toLowerCase()
  if (value) {
    const normalized = normalizeFloridaCountyCode(value)
    if (isValidFloridaCountyCode(normalized)) {
      return normalized
    }
  }
  return null
}

/**
 * Read active market + locality scope from cookies for server components (SSR).
 */
export function getServerMarketScope(): IServerMarketScope {
  const marketCode = getServerMarketCode()
  const town = getServerTownCode(marketCode)
  return {
    marketCode,
    town,
    county: getServerCountyCode(marketCode, town),
  }
}
