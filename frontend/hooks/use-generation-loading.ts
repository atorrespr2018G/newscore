'use client'

import { useEffect, useRef, useState } from 'react'

/** Fail loud if a Configuration scope load never settles. */
const LOAD_TIMEOUT_MS = 15_000

/**
 * Run an async load keyed by a scope string, with generation-safe loading state.
 *
 * When the scope changes quickly, only the latest request may clear `loading`
 * or apply results (`isCurrent`). Stale work cannot leave a permanent spinner
 * or overwrite newer data. A timeout rejects hung requests so the UI recovers.
 *
 * @param scopeKey Stable key for the active load scope (e.g. market+region).
 * @param load Async work for that scope; call `isCurrent` before setState.
 * @returns Whether the latest in-flight load is still pending.
 */
export function useGenerationLoading(
  scopeKey: string,
  load: (isCurrent: () => boolean) => Promise<void>,
): boolean {
  const [loading, setLoading] = useState(true)
  const generationRef = useRef(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    setLoading(true)

    const isCurrent = (): boolean => generationRef.current === generation
    let timeoutId = 0

    const timedLoad = Promise.race([
      loadRef.current(isCurrent),
      new Promise<void>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`Configuration load timed out after ${LOAD_TIMEOUT_MS}ms`))
        }, LOAD_TIMEOUT_MS)
      }),
    ])

    void timedLoad
      .catch((error: unknown) => {
        if (!isCurrent()) {
          return
        }
        // Surface hang/timeouts; callers that catch inside `load` already toasted.
        if (error instanceof Error && error.message.includes('timed out')) {
          console.error(error.message)
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (isCurrent()) {
          setLoading(false)
        }
      })
  }, [scopeKey])

  return loading
}
