'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface IErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * App-level error boundary for recoverable route failures.
 *
 * @param props.error Thrown error from a child segment.
 * @param props.reset Re-renders the failed segment.
 * @returns Localized error UI with a retry action.
 */
export default function ErrorPage({ error, reset }: IErrorPageProps): JSX.Element {
  const t = useTranslations('common')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-black text-neutral-900">{t('failedToLoad', { message: error.message })}</h1>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
      >
        Try again
      </button>
    </main>
  )
}
