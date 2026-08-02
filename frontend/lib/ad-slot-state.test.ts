import { MOCK_AD_LATENCY_MS } from '@/lib/mock-ads'
import { resolveMockDeliveryState } from '@/lib/ad-slot-state'

describe('resolveMockDeliveryState', () => {
  it('returns empty when mode is off or gam', () => {
    expect(resolveMockDeliveryState({ mode: 'off', elapsedMs: 0 })).toBe('empty')
    expect(resolveMockDeliveryState({ mode: 'off', elapsedMs: MOCK_AD_LATENCY_MS })).toBe('empty')
    expect(resolveMockDeliveryState({ mode: 'gam', elapsedMs: MOCK_AD_LATENCY_MS })).toBe('empty')
  })

  it('returns loading before mock latency elapses', () => {
    expect(resolveMockDeliveryState({ mode: 'mock', elapsedMs: 0 })).toBe('loading')
    expect(resolveMockDeliveryState({ mode: 'mock', elapsedMs: MOCK_AD_LATENCY_MS - 1 })).toBe(
      'loading',
    )
  })

  it('returns filled once mock latency elapses', () => {
    expect(resolveMockDeliveryState({ mode: 'mock', elapsedMs: MOCK_AD_LATENCY_MS })).toBe('filled')
    expect(resolveMockDeliveryState({ mode: 'mock', elapsedMs: MOCK_AD_LATENCY_MS + 50 })).toBe(
      'filled',
    )
  })

  it('honors a custom latency override', () => {
    expect(resolveMockDeliveryState({ mode: 'mock', elapsedMs: 100, latencyMs: 200 })).toBe(
      'loading',
    )
    expect(resolveMockDeliveryState({ mode: 'mock', elapsedMs: 200, latencyMs: 200 })).toBe(
      'filled',
    )
  })
})
