/** Editor scope driving all admin workflow reads and writes. */
export interface IEditorScope {
  marketCode: string
  townId: string | null
  pageName: string
}

export const DEFAULT_EDITOR_MARKET_CODE = 'us'
export const DEFAULT_EDITOR_PAGE_NAME = 'homepage'

/** Default editor scope used before market/town pickers are introduced. */
export const DEFAULT_EDITOR_SCOPE: IEditorScope = {
  marketCode: DEFAULT_EDITOR_MARKET_CODE,
  townId: null,
  pageName: DEFAULT_EDITOR_PAGE_NAME,
}

/** Curatable layout pages an editor can switch between. */
export const EDITOR_PAGE_OPTIONS: ReadonlyArray<string> = ['homepage', 'world']

/** Market codes an editor can curate from the scope switcher. */
export const EDITOR_MARKET_OPTIONS: ReadonlyArray<string> = ['us', 'co', 'uk', 'ca', 'au']

/**
 * Return whether a market code is supported by the editor scope switcher.
 *
 * @param marketCode Market short code to validate.
 * @returns True when the code can be used for editorial curation.
 */
export function isEditorMarketCode(marketCode: string): boolean {
  const normalized = marketCode.trim().toLowerCase()
  return EDITOR_MARKET_OPTIONS.includes(normalized)
}
