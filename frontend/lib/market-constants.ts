export interface IMarketOption {
  code: string
  label: string
}

export const MARKET_COOKIE_NAME = 'newscore_market'
export const MARKET_STORAGE_KEY = 'newscore_market'
export const DEFAULT_MARKET_CODE = 'us'

export const MARKET_OPTIONS: IMarketOption[] = [
  { code: 'us', label: 'USA' },
  { code: 'co', label: 'Colombia' },
]

export function isValidMarketCode(code: string): boolean {
  const normalized = code.trim().toLowerCase()
  return MARKET_OPTIONS.some((option) => option.code === normalized)
}
