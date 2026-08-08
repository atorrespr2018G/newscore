'use client'

import { PointerEvent, useRef } from 'react'

const HANDLE_HIT_PX = 14

type TimelineHandle = 'in' | 'out' | 'playhead'

interface ISegmentTimelineBarProps {
  duration: number
  startSeconds: number
  endSeconds: number
  playheadSeconds: number
  onChangeRange: (startSeconds: number, endSeconds: number) => void
  onSeek: (seconds: number) => void
}

/**
 * Map a pointer X position on the track to a time in seconds.
 * @param clientX - Pointer viewport X.
 * @param track - Timeline track element.
 * @param duration - Full source duration.
 * @returns Clamped time in seconds.
 */
function timeFromClientX(clientX: number, track: HTMLElement, duration: number): number {
  const rect = track.getBoundingClientRect()
  if (rect.width <= 0 || duration <= 0) return 0
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return Number((ratio * duration).toFixed(2))
}

/**
 * Pick which handle is nearest to a click, or fall back to seeking the playhead.
 * @param clientX - Pointer viewport X.
 * @param track - Timeline track element.
 * @param options - Current times and duration.
 * @returns Handle to drag, or playhead seek.
 */
function pickHandle(
  clientX: number,
  track: HTMLElement,
  options: { duration: number; startSeconds: number; endSeconds: number },
): TimelineHandle {
  const rect = track.getBoundingClientRect()
  if (rect.width <= 0 || options.duration <= 0) return 'playhead'
  const toX = (seconds: number) => rect.left + (seconds / options.duration) * rect.width
  const distIn = Math.abs(clientX - toX(options.startSeconds))
  const distOut = Math.abs(clientX - toX(options.endSeconds))
  if (distIn <= HANDLE_HIT_PX && distIn <= distOut) return 'in'
  if (distOut <= HANDLE_HIT_PX) return 'out'
  return 'playhead'
}

/**
 * Dual-handle timeline bar for setting segment in/out by dragging the bar.
 * @param props - Duration, range, playhead, and change callbacks.
 * @returns Interactive timeline control.
 */
export function SegmentTimelineBar({
  duration,
  startSeconds,
  endSeconds,
  playheadSeconds,
  onChangeRange,
  onSeek,
}: ISegmentTimelineBarProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<TimelineHandle | null>(null)

  const safeDuration = duration > 0 ? duration : 1
  const startPct = Math.min(100, Math.max(0, (startSeconds / safeDuration) * 100))
  const endPct = Math.min(100, Math.max(0, (endSeconds / safeDuration) * 100))
  const playPct = Math.min(100, Math.max(0, (playheadSeconds / safeDuration) * 100))

  function applyPointer(clientX: number, handle: TimelineHandle): void {
    const track = trackRef.current
    if (!track) return
    const time = timeFromClientX(clientX, track, safeDuration)
    if (handle === 'playhead') {
      onSeek(time)
      return
    }
    if (handle === 'in') {
      const nextStart = Math.min(time, endSeconds - 0.1)
      onChangeRange(Math.max(0, nextStart), endSeconds)
      onSeek(Math.max(0, nextStart))
      return
    }
    const nextEnd = Math.max(time, startSeconds + 0.1)
    onChangeRange(startSeconds, Math.min(safeDuration, nextEnd))
    onSeek(Math.min(safeDuration, nextEnd))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    const track = trackRef.current
    if (!track) return
    event.preventDefault()
    const handle = pickHandle(event.clientX, track, {
      duration: safeDuration,
      startSeconds,
      endSeconds,
    })
    dragRef.current = handle
    track.setPointerCapture(event.pointerId)
    applyPointer(event.clientX, handle)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragRef.current) return
    applyPointer(event.clientX, dragRef.current)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (!dragRef.current) return
    dragRef.current = null
    if (trackRef.current?.hasPointerCapture(event.pointerId)) {
      trackRef.current.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Segment timeline"
        aria-valuemin={0}
        aria-valuemax={safeDuration}
        aria-valuenow={playheadSeconds}
        tabIndex={0}
        className="relative h-10 cursor-pointer touch-none rounded-xl bg-brand-mist"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-y-2 rounded-lg bg-brand/35"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-slate-700/70"
          style={{ left: `${playPct}%` }}
        />
        <div
          className="absolute top-1 bottom-1 z-10 w-3 -translate-x-1/2 rounded-md border-2 border-white bg-brand shadow"
          style={{ left: `${startPct}%` }}
          title="In"
        />
        <div
          className="absolute top-1 bottom-1 z-10 w-3 -translate-x-1/2 rounded-md border-2 border-white bg-brand-ink shadow"
          style={{ left: `${endPct}%` }}
          title="Out"
        />
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>In {startSeconds.toFixed(1)}s</span>
        <span>Drag red = in · dark = out · click bar to scrub</span>
        <span>Out {endSeconds.toFixed(1)}s</span>
      </div>
    </div>
  )
}
