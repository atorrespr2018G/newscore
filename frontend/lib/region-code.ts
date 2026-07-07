import { normalizeFloridaCountyCode } from '@/lib/florida-counties'

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
