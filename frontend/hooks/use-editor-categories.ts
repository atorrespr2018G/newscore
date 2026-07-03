'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getCategories, type ICategoryOut } from '@/lib/api/category-client'
import type { IEditorStatus } from '@/interfaces/editor-article'

/**
 * Load the available categories once, surfacing failures on the status banner.
 *
 * @param status Shared status banners.
 * @returns Loaded category list (empty until the request resolves).
 */
export function useEditorCategories(status: IEditorStatus): ICategoryOut[] {
  const t = useTranslations('admin')
  const { setError } = status
  const [categories, setCategories] = useState<ICategoryOut[]>([])

  useEffect(() => {
    void getCategories()
      .then((items) => setCategories(items))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('editor.errors.loadCategories'))
      })
  }, [setError, t])

  return categories
}
