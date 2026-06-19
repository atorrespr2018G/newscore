import type { IEditorScope } from '@/lib/editor/editor-scope'

/** localStorage key recording the last homepage preview stale signal. */
export const EDITORIAL_PREVIEW_STALE_AT_KEY = 'editorial-preview-stale-at'

/** Broadcast channel used to sync preview stale signals across tabs. */
const EDITORIAL_PREVIEW_CHANNEL_NAME = 'editorial-preview-stale'

interface IEditorialPreviewStalePayload {
  staleAt: number
  scope: IEditorScope | null
}

type StaleListener = (payload: IEditorialPreviewStalePayload) => void

const staleListeners = new Set<StaleListener>()

let broadcastChannel: BroadcastChannel | null = null

/**
 * Lazily open the shared broadcast channel for preview stale signals.
 *
 * @returns Broadcast channel, or null when unavailable.
 */
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(EDITORIAL_PREVIEW_CHANNEL_NAME)
  }
  return broadcastChannel
}

function notifyStaleListeners(payload: IEditorialPreviewStalePayload): void {
  for (const listener of staleListeners) {
    listener(payload)
  }
}

/**
 * Notify listeners that homepage preview data may be stale.
 *
 * Same-tab listeners are invoked immediately. Other tabs receive the signal
 * through localStorage and BroadcastChannel.
 */
export function notifyEditorialPreviewStale(scope: IEditorScope | null = null): void {
  if (typeof window === 'undefined') {
    return
  }
  const payload: IEditorialPreviewStalePayload = {
    staleAt: Date.now(),
    scope,
  }
  localStorage.setItem(EDITORIAL_PREVIEW_STALE_AT_KEY, JSON.stringify(payload))
  notifyStaleListeners(payload)
  getBroadcastChannel()?.postMessage(payload)
}

/**
 * Read the timestamp of the latest preview stale signal.
 *
 * @returns Unix milliseconds, or 0 when none recorded.
 */
export function getEditorialPreviewStaleAt(): number {
  if (typeof window === 'undefined') {
    return 0
  }
  const raw = localStorage.getItem(EDITORIAL_PREVIEW_STALE_AT_KEY)
  if (!raw) {
    return 0
  }
  const payload = parseStalePayload(raw)
  return payload?.staleAt ?? 0
}

/**
 * Subscribe to homepage preview stale signals.
 *
 * @param listener Callback invoked when preview data may be stale.
 * @returns Unsubscribe function.
 */
export function subscribeToEditorialPreviewStale(listener: StaleListener): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  staleListeners.add(listener)

  const onStorage = (event: StorageEvent): void => {
    if (event.key !== EDITORIAL_PREVIEW_STALE_AT_KEY || !event.newValue) {
      return
    }
    const payload = parseStalePayload(event.newValue)
    if (payload) {
      listener(payload)
    }
  }
  window.addEventListener('storage', onStorage)

  const channel = getBroadcastChannel()
  const onBroadcast = (event: MessageEvent<IEditorialPreviewStalePayload>): void => {
    if (event.data?.staleAt) {
      listener(event.data)
    }
  }
  channel?.addEventListener('message', onBroadcast)

  return () => {
    staleListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onBroadcast)
  }
}

function parseStalePayload(raw: string): IEditorialPreviewStalePayload | null {
  try {
    const parsed = JSON.parse(raw) as IEditorialPreviewStalePayload
    if (!Number.isFinite(parsed.staleAt)) {
      return null
    }
    return {
      staleAt: parsed.staleAt,
      scope: parsed.scope ?? null,
    }
  } catch {
    const staleAt = Number(raw)
    if (!Number.isFinite(staleAt)) {
      return null
    }
    return { staleAt, scope: null }
  }
}
