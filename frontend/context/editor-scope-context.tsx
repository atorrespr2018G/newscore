'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { decodeJwtPayload } from '@/lib/helpers/jwt'
import {
  DEFAULT_EDITOR_SCOPE,
  type IEditorScope,
  DEFAULT_EDITOR_MARKET_CODE,
} from '@/lib/editor/editor-scope'
import { getStoredToken } from '@/lib/api/auth'

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
 * @param children Nested admin route UI.
 * @returns Scope provider for editor routes.
 */
export function EditorScopeProvider({ children }: IEditorScopeProviderProps): JSX.Element {
  const [scope, setScope] = useState<IEditorScope>(() => resolveInitialEditorScope())
  const value = useMemo(
    () => ({
      scope,
      setScope,
    }),
    [scope],
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
  const context = useContext(EditorScopeContext)
  if (!context) {
    throw new Error('useEditorScope must be used within EditorScopeProvider')
  }
  return context.scope
}

/**
 * Resolve initial editor scope from JWT claims when available.
 *
 * @returns Initial editor scope.
 */
function resolveInitialEditorScope(): IEditorScope {
  if (typeof window === 'undefined') {
    return DEFAULT_EDITOR_SCOPE
  }
  const token = getStoredToken()
  const payload = token ? decodeJwtPayload(token) : null
  const payloadWithMarket = payload as { market_code?: string } | null
  return {
    ...DEFAULT_EDITOR_SCOPE,
    marketCode: payloadWithMarket?.market_code ?? DEFAULT_EDITOR_MARKET_CODE,
  }
}
