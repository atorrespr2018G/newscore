import { normalizeFloridaCountyCode } from '@/lib/taxonomy/florida-counties'

/**
 * Build a canonical region code from market + locality + optional county.
 * @param marketCode - Market short code such as `us`, `pr`, or `co`.
 * @param locality - State or town code, when set.
 * @param county - Florida county code, when set.
 * @returns Region code such as `us-fl-miami-dade`.
 */

export function toRegionCode(
  marketCode: string,
  locality: string | null | undefined,
  county: string | null | undefined = null,
): string {
  const market = marketCode.trim().toLowerCase()
  const town = (locality ?? '').trim().toLowerCase()
  const countyCode = normalizeFloridaCountyCode((county ?? '').trim().toLowerCase())

  if (countyCode) {
    return town ? `${market}-${town}-${countyCode}` : `${market}-${countyCode}`
  }

  if (!town) {
    return market
  }
  return `${market}-${town}`
}
