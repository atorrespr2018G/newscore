'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import {
  homepageSectionTitle as resolveHomepageSectionTitle,
  sectionLabel as resolveSectionLabel,
} from '@/lib/helpers/section-labels'

/**
 * Client hook for localized section headings used in homepage modules and nav.
 */
export function useSectionLabels(pageName?: string): {
  sectionLabel: (positionKey: string) => string
  homepageSectionTitle: (positionKey: string, displayName?: string | null) => string
} {
  const t = useTranslations('navigation')

  const sectionLabel = useCallback(
    (positionKey: string) => resolveSectionLabel(positionKey, t),
    [t],
  )

  const homepageSectionTitle = useCallback(
    (positionKey: string, displayName?: string | null) =>
      resolveHomepageSectionTitle(positionKey, displayName, t, pageName),
    [t, pageName],
  )

  return { sectionLabel, homepageSectionTitle }
}
