import { getStoredToken } from '@/lib/api/auth'
import {
  DEFAULT_EDITOR_MARKET_CODE,
  DEFAULT_EDITOR_SCOPE,
  type IEditorScope,
} from '@/lib/editor/editor-scope'
import { decodeJwtPayload } from '@/lib/helpers/jwt'

/** localStorage key persisting the active editor scope across windows. */
const EDITOR_SCOPE_STORAGE_KEY = 'editor-scope'

/** Broadcast channel used to sync editor scope across same-browser windows. */
const EDITOR_SCOPE_CHANNEL_NAME = 'editor-scope-sync'

let broadcastChannel: BroadcastChannel | null = null

/**
 * Lazily open the shared broadcast channel for editor scope sync.
 *
 * @returns Broadcast channel, or null when unavailable (SSR/unsupported).
 */
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(EDITOR_SCOPE_CHANNEL_NAME)
  }
  return broadcastChannel
}

/**
 * Parse a persisted editor scope, returning null when malformed.
 *
 * @param raw Serialized scope payload from storage or a broadcast event.
 * @returns The parsed scope, or null when the payload is invalid.
 */
function parseEditorScope(raw: string): IEditorScope | null {
  try {
    const parsed = JSON.parse(raw) as Partial<IEditorScope>
    if (typeof parsed.marketCode !== 'string' || typeof parsed.pageName !== 'string') {
      return null
    }
    return {
      marketCode: parsed.marketCode,
      townId: typeof parsed.townId === 'string' ? parsed.townId : null,
      pageName: parsed.pageName,
    }
  } catch {
    return null
  }
}

/**
 * Read the persisted editor scope from localStorage.
 *
 * @returns The stored scope, or null when none is recorded.
 */
export function readStoredEditorScope(): IEditorScope | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = localStorage.getItem(EDITOR_SCOPE_STORAGE_KEY)
  return raw ? parseEditorScope(raw) : null
}

/**
 * Persist the editor scope and broadcast it to other windows.
 *
 * @param scope Scope to persist as the shared active scope.
 */
export function persistEditorScope(scope: IEditorScope): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(EDITOR_SCOPE_STORAGE_KEY, JSON.stringify(scope))
  getBroadcastChannel()?.postMessage(scope)
}

/**
 * Resolve the initial editor scope, preferring the persisted shared scope.
 *
 * Falls back to the market claimed by the stored JWT so a fresh window opens on
 * the editor's own market when no shared scope has been recorded yet.
 *
 * @returns Initial editor scope for a newly mounted provider.
 */
export function resolveInitialEditorScope(): IEditorScope {
  if (typeof window === 'undefined') {
    return DEFAULT_EDITOR_SCOPE
  }
  const stored = readStoredEditorScope()
  if (stored) {
    return stored
  }
  const token = getStoredToken()
  const payload = token ? decodeJwtPayload(token) : null
  const payloadWithMarket = payload as { market_code?: string } | null
  return {
    ...DEFAULT_EDITOR_SCOPE,
    marketCode: payloadWithMarket?.market_code ?? DEFAULT_EDITOR_MARKET_CODE,
  }
}

/**
 * Subscribe to editor scope changes made in other windows/tabs.
 *
 * Listens to both `storage` events (cross-window localStorage writes) and the
 * broadcast channel so the two editor pages always target the same scope.
 *
 * @param listener Callback invoked with the externally updated scope.
 * @returns Unsubscribe function.
 */
export function subscribeToEditorScope(listener: (scope: IEditorScope) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key !== EDITOR_SCOPE_STORAGE_KEY || !event.newValue) {
      return
    }
    const scope = parseEditorScope(event.newValue)
    if (scope) {
      listener(scope)
    }
  }
  window.addEventListener('storage', onStorage)

  const channel = getBroadcastChannel()
  const onBroadcast = (event: MessageEvent<IEditorScope>): void => {
    if (event.data?.marketCode) {
      listener(event.data)
    }
  }
  channel?.addEventListener('message', onBroadcast)

  return () => {
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onBroadcast)
  }
}
