'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useBreaking } from '@/hooks/use-breaking'

function BreakingTickerContent(): JSX.Element | null {
  const t = useTranslations('common')
  const { data } = useBreaking()

  const items = Array.isArray((data as { payload?: { items?: unknown[] } })?.payload?.items)
    ? ((data as { payload: { items: unknown[] } }).payload.items as Array<{ text?: string }>)
    : []
  const first = items[0]
  const text = first?.text ? String(first.text) : null

  if (!text) return null

  return (
    <div className="border-b border-neutral-200 bg-neutral-50" aria-live="polite" aria-atomic="true">
      <div className="site-container py-2">
        <div className="flex items-center gap-3">
          <span className="rounded bg-[color:var(--brand-red)] px-2 py-1 text-xs font-extrabold tracking-wide text-white">
            {t('breaking').toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="relative">
              <div className="ticker-animate animate-[ticker_18s_linear_infinite] whitespace-nowrap text-sm font-semibold text-neutral-900">
                <span className="mr-10">{text}</span>
                <span className="mr-10">{text}</span>
                <span className="mr-10">{text}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Breaking ticker with live region for screen readers.
 */
export function BreakingTicker(): JSX.Element | null {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return isMounted ? <BreakingTickerContent /> : null
}
