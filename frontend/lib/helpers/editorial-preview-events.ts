/** localStorage key recording the last homepage preview stale signal. */
export const EDITORIAL_PREVIEW_STALE_AT_KEY = 'editorial-preview-stale-at'

/** Broadcast channel used to sync preview stale signals across tabs. */
const EDITORIAL_PREVIEW_CHANNEL_NAME = 'editorial-preview-stale'

type StaleListener = () => void

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

/**
 * Invoke all in-memory preview stale listeners.
 */
function notifyStaleListeners(): void {
  for (const listener of staleListeners) {
    listener()
  }
}

/**
 * Notify listeners that homepage preview data may be stale.
 *
 * Same-tab listeners are invoked immediately. Other tabs receive the signal
 * through localStorage and BroadcastChannel.
 */
export function notifyEditorialPreviewStale(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(EDITORIAL_PREVIEW_STALE_AT_KEY, String(Date.now()))
  notifyStaleListeners()
  getBroadcastChannel()?.postMessage('stale')
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
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
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
    if (event.key === EDITORIAL_PREVIEW_STALE_AT_KEY) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)

  const channel = getBroadcastChannel()
  const onBroadcast = (): void => {
    listener()
  }
  channel?.addEventListener('message', onBroadcast)

  return () => {
    staleListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onBroadcast)
  }
}
