import { cookies } from 'next/headers'

import {
  DEFAULT_MARKET_CODE,
  isValidMarketCode,
  MARKET_COOKIE_NAME,
} from '@/lib/market-constants'

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
