'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_EDITOR_SCOPE, type IEditorScope } from '@/lib/editor/editor-scope'
import {
  persistEditorScope,
  resolveEditorScopeFromToken,
  resolveInitialEditorScope,
  subscribeToEditorScope,
} from '@/lib/editor/editor-scope-storage'

interface IEditorScopeContextValue {
  scope: IEditorScope
  setScope: (nextScope: IEditorScope) => void
}

const EditorScopeContext = createContext<IEditorScopeContextValue | null>(null)

interface IEditorScopeProviderProps {
  children: ReactNode
  /**
   * When false, scope stays within this subtree and ignores Placement's shared
   * market/state/town selection (used by the News editor page).
   */
  sync?: boolean
}

/**
 * Stores the active editor scope for admin workflow pages.
 *
 * With the default `sync` mode the scope is persisted to localStorage and synced
 * across same-browser windows so the Placement page and preview stay aligned.
 * News uses `sync={false}` so Placement scope changes do not affect the editor.
 *
 * Initial state is always the default scope so SSR and the first client render
 * match (avoids State/Town hydration mismatches). Stored/token scope is applied
 * after mount.
 *
 * @param props Nested admin route UI and optional sync mode.
 * @returns Scope provider for editor routes.
 */
export function EditorScopeProvider({
  children,
  sync = true,
}: IEditorScopeProviderProps): JSX.Element {
  const [scope, setScopeState] = useState<IEditorScope>(DEFAULT_EDITOR_SCOPE)

  // Apply persisted or token scope after mount so SSR HTML matches the client.
  useEffect(() => {
    setScopeState(sync ? resolveInitialEditorScope() : resolveEditorScopeFromToken())
  }, [sync])

  // A local change persists and broadcasts so the other editor window follows.
  const setScope = useCallback(
    (nextScope: IEditorScope) => {
      setScopeState(nextScope)
      if (sync) {
        persistEditorScope(nextScope)
      }
    },
    [sync],
  )

  // Apply scope changes originating from another window without re-broadcasting.
  useEffect(() => {
    if (!sync) {
      return
    }
    return subscribeToEditorScope(setScopeState)
  }, [sync])

  const value = useMemo(
    () => ({
      scope,
      setScope,
    }),
    [scope, setScope],
  )
  return <EditorScopeContext.Provider value={value}>{children}</EditorScopeContext.Provider>
}

/**
 * Read the current editor scope.
 *
 * @returns Active market/town/page scope.
 * @throws Error When used outside EditorScopeProvider.
 */
export function useEditorScope(): IEditorScope {
  return useEditorScopeContext().scope
}

/**
 * Read the editor scope together with its setter for scope switchers.
 *
 * @returns Active scope and the setter to change it.
 * @throws Error When used outside EditorScopeProvider.
 */
export function useEditorScopeContext(): IEditorScopeContextValue {
  const context = useContext(EditorScopeContext)
  if (!context) {
    throw new Error('useEditorScope must be used within EditorScopeProvider')
  }
  return context
}
