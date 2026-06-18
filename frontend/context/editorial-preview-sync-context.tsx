'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { subscribeToEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'

interface IEditorialPreviewSyncContextValue {
  /** Increments whenever editor changes require preview reload. */
  staleToken: number
}

const EditorialPreviewSyncContext = createContext<IEditorialPreviewSyncContextValue | null>(null)

interface IEditorialPreviewSyncProviderProps {
  children: ReactNode
}

/**
 * Tracks homepage preview staleness across admin workflow routes and tabs.
 *
 * Stays mounted in the admin layout so editor-side changes can be observed
 * before the standalone preview page mounts.
 */
export function EditorialPreviewSyncProvider({
  children,
}: IEditorialPreviewSyncProviderProps): JSX.Element {
  const [staleToken, setStaleToken] = useState(0)

  useEffect(() => {
    return subscribeToEditorialPreviewStale(() => {
      setStaleToken((current) => current + 1)
    })
  }, [])

  const value = useMemo(
    () => ({
      staleToken,
    }),
    [staleToken],
  )

  return (
    <EditorialPreviewSyncContext.Provider value={value}>
      {children}
    </EditorialPreviewSyncContext.Provider>
  )
}

/**
 * Read the current homepage preview stale token.
 *
 * @returns Stale token that increments after editor-side changes.
 */
export function useEditorialPreviewStaleToken(): number {
  const context = useContext(EditorialPreviewSyncContext)
  if (context === null) {
    throw new Error('useEditorialPreviewStaleToken must be used within EditorialPreviewSyncProvider')
  }
  return context.staleToken
}
