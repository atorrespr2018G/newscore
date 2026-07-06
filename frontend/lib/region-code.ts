export function toRegionCode(marketCode: string, locality: string | null | undefined): string {
  const market = marketCode.trim().toLowerCase()
  const town = (locality ?? '').trim().toLowerCase()
  if (!town) {
    return market
  }
  return `${market}-${town}`
}
