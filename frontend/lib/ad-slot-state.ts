import { shouldServeMockAds, type AdsMode } from '@/lib/ad-config'
import { MOCK_AD_LATENCY_MS } from '@/lib/mock-ads'

export type AdSlotRenderState = 'loading' | 'filled' | 'empty'

interface IResolveMockDeliveryStateOptions {
  mode: AdsMode
  /** Milliseconds since the slot began requesting inventory. */
  elapsedMs: number
  latencyMs?: number
}

/**
 * Resolve the mock/off delivery state for an ad slot.
 *
 * @param options - Mode, elapsed time, and optional latency override.
 * @returns `empty` when ads are off; otherwise loading until latency elapses, then filled.
 */
export function resolveMockDeliveryState(
  options: IResolveMockDeliveryStateOptions,
): AdSlotRenderState {
  if (!shouldServeMockAds(options.mode)) {
    return 'empty'
  }

  const latencyMs = options.latencyMs ?? MOCK_AD_LATENCY_MS
  if (options.elapsedMs < latencyMs) {
    return 'loading'
  }

  return 'filled'
}
