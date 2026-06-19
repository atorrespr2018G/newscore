'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { IEditorScope } from '@/lib/editor/editor-scope'
import { subscribeToEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'

interface IEditorialPreviewSyncContextValue {
  /** Increments whenever editor changes require preview reload. */
  staleToken: number
  /** Scope associated with latest stale signal when available. */
  staleScope: IEditorScope | null
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
  const [staleScope, setStaleScope] = useState<IEditorialPreviewSyncContextValue['staleScope']>(null)

  useEffect(() => {
    return subscribeToEditorialPreviewStale((payload) => {
      setStaleToken((current) => current + 1)
      setStaleScope(payload.scope)
    })
  }, [])

  const value = useMemo(
    () => ({
      staleToken,
      staleScope,
    }),
    [staleScope, staleToken],
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

/**
 * Read the scope attached to the latest preview stale signal.
 *
 * @returns Scope of last stale signal, or null when unknown.
 */
export function useEditorialPreviewStaleScope(): IEditorialPreviewSyncContextValue['staleScope'] {
  const context = useContext(EditorialPreviewSyncContext)
  if (context === null) {
    throw new Error('useEditorialPreviewStaleScope must be used within EditorialPreviewSyncProvider')
  }
  return context.staleScope
}
