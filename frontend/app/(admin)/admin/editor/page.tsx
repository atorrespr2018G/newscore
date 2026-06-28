'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

/** Default editor sub-route landed on when opening the Editor workflow. */
const EDITOR_NEWS_ROUTE = '/admin/editor/news'

/** Redirect the legacy combined Editor route to the News page. */
export default function EditorIndexPage(): JSX.Element | null {
  const router = useRouter()
  const t = useTranslations('admin')

  useEffect(() => {
    router.replace(EDITOR_NEWS_ROUTE)
  }, [router])

  return (
    <p className="text-neutral-600" aria-live="polite">
      {t('editor.loading')}
    </p>
  )
}
