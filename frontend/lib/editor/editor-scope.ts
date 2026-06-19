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
