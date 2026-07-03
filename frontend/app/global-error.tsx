'use client'

import { useEffect } from 'react'

interface IGlobalErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root error boundary that must render its own document shell.
 *
 * @param props.error Uncaught error from the root layout tree.
 * @param props.reset Re-renders the failed tree.
 * @returns Minimal HTML error page with retry.
 */
export default function GlobalErrorPage({ error, reset }: IGlobalErrorPageProps): JSX.Element {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-3xl px-4 py-16 font-sans">
          <h1 className="text-2xl font-black text-neutral-900">Something went wrong</h1>
          <p className="mt-4 text-neutral-700">{error.message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
