'use client'

import { useEffect, useState } from 'react'

import { type ILanguageEntry, loadLanguageRegistry } from '@/lib/i18n/language-registry'

/**
 * Client hook for the enabled language catalog used by the masthead selector.
 */
export function useLanguageRegistry(): ILanguageEntry[] {
  const [languages, setLanguages] = useState<ILanguageEntry[]>([])

  useEffect(() => {
    let active = true

    void loadLanguageRegistry().then((entries) => {
      if (active) {
        setLanguages(entries)
      }
    })

    return () => {
      active = false
    }
  }, [])

  return languages
}
