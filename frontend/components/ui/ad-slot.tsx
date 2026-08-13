'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { useAds } from '@/context/ad-provider'
import {
  AD_VARIANT_SHELL_CLASS,
  getSlotVariant,
  shouldServeMockAds,
  type AdSlotKey,
  type AdSlotVariant,
} from '@/lib/ad-config'
import { resolveMockDeliveryState, type AdSlotRenderState } from '@/lib/ad-slot-state'
import {
  MOCK_AD_LATENCY_MS,
  selectMockCreative,
  type IMockCreativeDefinition,
  type MockCreativeId,
} from '@/lib/mock-ads'

interface IAdSlotProps {
  slotKey: AdSlotKey
  /** Zero-based occurrence index when the same slot key appears multiple times. */
  index?: number
  /** Override the registry default layout variant. */
  variant?: AdSlotVariant
  className?: string
}

/**
 * Public-site ad unit. Serves mock creatives when mode is `mock`; otherwise
 * renders a reserved empty placeholder. Does not load Google GPT in this phase.
 */
export function AdSlot({ slotKey, index = 0, variant, className }: IAdSlotProps): JSX.Element {
  const { mode } = useAds()
  const resolvedVariant = variant ?? getSlotVariant(slotKey)
  const serveMock = shouldServeMockAds(mode)
  const renderState = useMockAdState(serveMock)
  const creative = serveMock ? selectMockCreative(slotKey, index) : null

  return (
    <AdSlotFrame
      variant={resolvedVariant}
      className={className}
      renderState={renderState}
      creative={creative}
    />
  )
}

/**
 * Track mock delivery lifecycle: reserved loading shell, then filled creative.
 *
 * @param serveMock - Whether mock delivery is enabled.
 * @returns Current render state for the slot.
 */
function useMockAdState(serveMock: boolean): AdSlotRenderState {
  const mode = serveMock ? 'mock' : 'off'
  const [elapsedMs, setElapsedMs] = useState(0)
  const renderState = resolveMockDeliveryState({ mode, elapsedMs })

  useEffect(() => {
    if (!serveMock) {
      setElapsedMs(0)
      return
    }

    setElapsedMs(0)
    const timer = window.setTimeout(() => setElapsedMs(MOCK_AD_LATENCY_MS), MOCK_AD_LATENCY_MS)
    return () => window.clearTimeout(timer)
  }, [serveMock])

  return renderState
}

interface IAdSlotFrameProps {
  variant: AdSlotVariant
  className?: string
  renderState: AdSlotRenderState
  creative: IMockCreativeDefinition | null
}

/**
 * Render the reserved shell and either a placeholder, loading state, or creative.
 */
function AdSlotFrame({ variant, className, renderState, creative }: IAdSlotFrameProps): JSX.Element {
  const tCommon = useTranslations('common')
  const isCompact = variant === 'sticky'
  const shellClass = [
    'flex items-center justify-center border px-4',
    isCompact ? 'rounded-sm' : 'rounded',
    AD_VARIANT_SHELL_CLASS[variant],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  if (renderState === 'filled' && creative) {
    return <MockCreativeView creative={creative} shellClass={shellClass} compact={isCompact} />
  }

  const isLoading = renderState === 'loading'
  return (
    <div
      className={`${shellClass} border-dashed border-neutral-300 bg-neutral-100`}
      role="img"
      aria-busy={isLoading || undefined}
      aria-label={isLoading ? undefined : tCommon('advertisement')}
    >
      <AdSlotStatusLabel isLoading={isLoading} />
    </div>
  )
}

/**
 * Localized status label for loading or empty placeholder states.
 */
function AdSlotStatusLabel({ isLoading }: { isLoading: boolean }): JSX.Element {
  const tCommon = useTranslations('common')
  const tAds = useTranslations('ads')
  const label = isLoading ? tAds('loading') : tCommon('advertisement')

  return (
    <span className="text-[11px] font-black tracking-[0.28em] text-neutral-500">
      {label.toUpperCase()}
    </span>
  )
}

interface IMockCreativeViewProps {
  creative: IMockCreativeDefinition
  shellClass: string
  compact?: boolean
}

interface ICreativeCopy {
  title: string
  subtitle: string
}

/**
 * Render a filled mock sponsored creative.
 */
function MockCreativeView({ creative, shellClass, compact = false }: IMockCreativeViewProps): JSX.Element {
  const tCommon = useTranslations('common')
  const copy = useCreativeCopy(creative.id)
  const adLabel = tCommon('advertisement')

  if (compact) {
    return (
      <CompactMockCreative
        shellClass={shellClass}
        accentClass={creative.accentClass}
        adLabel={adLabel}
        copy={copy}
        cta={tCommon('learnMore')}
      />
    )
  }

  return (
    <DefaultMockCreative
      shellClass={shellClass}
      accentClass={creative.accentClass}
      adLabel={adLabel}
      copy={copy}
      cta={tCommon('learnMore')}
    />
  )
}

interface IFilledCreativeProps {
  shellClass: string
  accentClass: string
  adLabel: string
  copy: ICreativeCopy
  cta: string
}

/**
 * Compact horizontal creative for sticky footer ribbons.
 *
 * @param props - Shell classes, copy, and CTA label.
 */
function CompactMockCreative(props: IFilledCreativeProps): JSX.Element {
  const { shellClass, accentClass, adLabel, copy, cta } = props
  return (
    <div
      className={`${shellClass} border-neutral-200 ${accentClass}`}
      role="img"
      aria-label={adLabel}
    >
      <div className="flex w-full max-w-5xl items-center justify-between gap-4 px-2">
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-black tracking-[0.24em] opacity-70">
            {adLabel.toUpperCase()}
          </p>
          <p className="truncate text-base font-black leading-tight">{copy.title}</p>
          <p className="truncate text-xs opacity-80">{copy.subtitle}</p>
        </div>
        <p className="shrink-0 border border-current px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]">
          {cta}
        </p>
      </div>
    </div>
  )
}

/**
 * Standard centered creative for in-page ad shells.
 *
 * @param props - Shell classes, copy, and CTA label.
 */
function DefaultMockCreative(props: IFilledCreativeProps): JSX.Element {
  const { shellClass, accentClass, adLabel, copy, cta } = props
  return (
    <div
      className={`${shellClass} border-neutral-200 ${accentClass}`}
      role="img"
      aria-label={adLabel}
    >
      <div className="max-w-xl text-center">
        <p className="text-[11px] font-black tracking-[0.28em] opacity-70">
          {adLabel.toUpperCase()}
        </p>
        <p className="mt-3 text-2xl font-black leading-tight">{copy.title}</p>
        <p className="mt-2 text-sm leading-6 opacity-80">{copy.subtitle}</p>
        <p className="mt-4 inline-block border border-current px-4 py-2 text-xs font-bold uppercase tracking-[0.16em]">
          {cta}
        </p>
      </div>
    </div>
  )
}

/**
 * Resolve localized title/subtitle for a mock creative id.
 *
 * @param creativeId - Catalog creative identifier.
 * @returns Localized title and subtitle.
 */
function useCreativeCopy(creativeId: MockCreativeId): { title: string; subtitle: string } {
  const tAds = useTranslations('ads')
  return {
    title: tAds(`creatives.${creativeId}.title`),
    subtitle: tAds(`creatives.${creativeId}.subtitle`),
  }
}
