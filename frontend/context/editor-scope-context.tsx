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
import { type IEditorScope } from '@/lib/editor/editor-scope'
import {
  persistEditorScope,
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
}

/**
 * Stores the active editor scope for admin workflow pages.
 *
 * The scope is persisted to localStorage and synced across same-browser windows
 * so the independent News and Placement pages always curate the same market/page.
 *
 * @param children Nested admin route UI.
 * @returns Scope provider for editor routes.
 */
export function EditorScopeProvider({ children }: IEditorScopeProviderProps): JSX.Element {
  const [scope, setScopeState] = useState<IEditorScope>(() => resolveInitialEditorScope())

  // A local change persists and broadcasts so the other editor window follows.
  const setScope = useCallback((nextScope: IEditorScope) => {
    setScopeState(nextScope)
    persistEditorScope(nextScope)
  }, [])

  // Apply scope changes originating from another window without re-broadcasting.
  useEffect(() => subscribeToEditorScope(setScopeState), [])

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
