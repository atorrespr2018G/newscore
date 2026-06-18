export interface ILanguageEntry {
  code: string
  displayName: string
  nativeName: string
  isEnabled: boolean
  textDirection: 'ltr' | 'rtl'
}

const STATIC_REGISTRY: ILanguageEntry[] = [
  {
    code: 'en',
    displayName: 'English',
    nativeName: 'English',
    isEnabled: true,
    textDirection: 'ltr',
  },
  {
    code: 'es',
    displayName: 'Spanish',
    nativeName: 'Español',
    isEnabled: true,
    textDirection: 'ltr',
  },
]

/**
 * Load enabled languages. Local config today; replace with API/CMS fetch later.
 */
export async function loadLanguageRegistry(): Promise<ILanguageEntry[]> {
  return STATIC_REGISTRY.filter((entry) => entry.isEnabled)
}
