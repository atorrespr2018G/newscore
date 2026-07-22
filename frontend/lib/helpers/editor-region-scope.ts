import { getRegionById } from '@/lib/api/region-client'
import type { IEditorScope } from '@/lib/editor/editor-scope'
import { normalizeFloridaCountyCode } from '@/lib/florida-counties'
import type { IArticleDetail } from '@/interfaces/editor-article'
import { PUERTO_RICO_MARKET_CODE } from '@/lib/puerto-rico-towns'
import { US_MARKET_CODE } from '@/lib/us-states'

type EditorLocalScopeType = Pick<IEditorScope, 'marketCode' | 'townId' | 'countyId'>

export type RegionLookupSourceType = 'code' | 'region-id' | 'lookup-error'

export interface IResolvedRegionCode {
  code: string | null
  source: RegionLookupSourceType
}

/**
 * Convert a canonical region code into editor scope locality fields.
 *
 * Supports rollout scopes such as `us`, `us-fl`, `us-fl-miami-dade`,
 * `pr`, and `pr-san-juan`.
 *
 * @param regionCode Canonical region code (e.g. `pr-vieques`).
 * @returns Market/town/county fields, or null when the code is empty.
 */
export function scopeFromRegionCode(regionCode: string): EditorLocalScopeType | null {
  const normalized = regionCode.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const parts = normalized.split('-')
  const marketCode = parts[0]
  if (!marketCode) {
    return null
  }

  if (marketCode === US_MARKET_CODE) {
    return usScopeFromParts(parts, marketCode)
  }

  if (marketCode === PUERTO_RICO_MARKET_CODE) {
    return {
      marketCode,
      townId: parts.length > 1 ? parts.slice(1).join('-') : null,
      countyId: null,
    }
  }

  return { marketCode, townId: null, countyId: null }
}

/**
 * Build US editor scope fields from a split region-code path.
 *
 * @param parts Lowercased code segments (`us`, state, optional county…).
 * @param marketCode Resolved US market code.
 * @returns US market/town/county scope fields.
 */
function usScopeFromParts(parts: string[], marketCode: string): EditorLocalScopeType {
  if (parts.length === 1) {
    return { marketCode, townId: null, countyId: null }
  }
  const stateCode = parts[1] ?? null
  if (!stateCode) {
    return { marketCode, townId: null, countyId: null }
  }
  const countyCode = parts.length > 2 ? normalizeFloridaCountyCode(parts.slice(2).join('-')) : null
  return {
    marketCode,
    townId: stateCode,
    countyId: countyCode || null,
  }
}

/**
 * Return whether a token already looks like a canonical region code.
 *
 * @param value Raw region token from an article or API.
 * @returns True when the value matches `us|pr|co` region-code shape.
 */
export function looksLikeRegionCode(value: string): boolean {
  return /^(us|pr|co)(-[a-z0-9]+)*$/i.test(value.trim())
}

/**
 * Resolve a region token (code or Mongo id) to a canonical region code.
 *
 * @param token Article `primary_region_id` or other region reference.
 * @returns Normalized code plus how it was resolved.
 */
export async function resolveRegionCode(token: string): Promise<IResolvedRegionCode> {
  const normalized = token.trim().toLowerCase()
  if (!normalized) {
    return { code: null, source: 'lookup-error' }
  }
  if (looksLikeRegionCode(normalized)) {
    return { code: normalized, source: 'code' }
  }
  try {
    const region = await getRegionById(normalized)
    return { code: region.code.trim().toLowerCase() || null, source: 'region-id' }
  } catch {
    return { code: null, source: 'lookup-error' }
  }
}

/**
 * Pick the best region token from an article detail payload.
 *
 * Prefers the primary region, then the first direct region, then the first
 * effective region — matching News detail scope resolution.
 *
 * @param article Article detail with geo fields.
 * @returns Region token, or null when the article has no geo tags.
 */
export function articleRegionToken(
  article: Pick<IArticleDetail, 'primary_region_id' | 'direct_region_ids' | 'effective_region_ids'>,
): string | null {
  return (
    article.primary_region_id ??
    article.direct_region_ids?.[0] ??
    article.effective_region_ids?.[0] ??
    null
  )
}

/**
 * Resolve the country/market code an article is tagged under.
 *
 * @param article Article detail with geo fields.
 * @returns Lowercased market code (`us`, `pr`, …), or null when unknown.
 */
export async function resolveArticleMarketCode(
  article: Pick<IArticleDetail, 'primary_region_id' | 'direct_region_ids' | 'effective_region_ids'>,
): Promise<string | null> {
  const token = articleRegionToken(article)
  if (!token) {
    return null
  }
  const { code } = await resolveRegionCode(token)
  if (!code) {
    return null
  }
  return scopeFromRegionCode(code)?.marketCode ?? null
}

/**
 * Return whether placing an article on the board crosses country boundaries.
 *
 * Unknown article markets are treated as in-country so a failed geo lookup
 * does not block editorial work.
 *
 * @param articleMarketCode Article country/market, or null when unresolved.
 * @param boardMarketCode Active placement board market code.
 * @returns True when both markets are known and differ.
 */
export function isCrossCountryPlacement(
  articleMarketCode: string | null,
  boardMarketCode: string,
): boolean {
  if (!articleMarketCode) {
    return false
  }
  return articleMarketCode.trim().toLowerCase() !== boardMarketCode.trim().toLowerCase()
}
