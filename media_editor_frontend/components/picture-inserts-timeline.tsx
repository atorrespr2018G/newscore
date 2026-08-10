'use client'

import { PointerEvent, useRef } from 'react'

const HANDLE_HIT_PX = 14
const MIN_PATCH_SECONDS = 0.1

type TimelineHandle = 'start' | 'end' | 'body' | 'playhead'

export interface IPicturePatch {
  id: string
  at_seconds: number
  duration_seconds: number
  source_asset_id: string
  source_in_seconds: number
  label: string
}

interface IPictureInsertsTimelineProps {
  duration: number
  patches: IPicturePatch[]
  activeId: string | null
  playheadSeconds: number
  onSelect: (id: string) => void
  onChangePatch: (id: string, atSeconds: number, durationSeconds: number) => void
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
 * Pick which handle on the active patch is nearest, or seek the playhead.
 * @param clientX - Pointer viewport X.
 * @param track - Timeline track element.
 * @param options - Duration and active patch window.
 * @returns Handle to drag.
 */
function pickHandle(
  clientX: number,
  track: HTMLElement,
  options: { duration: number; atSeconds: number; endSeconds: number },
): TimelineHandle {
  const rect = track.getBoundingClientRect()
  if (rect.width <= 0 || options.duration <= 0) return 'playhead'
  const toX = (seconds: number) => rect.left + (seconds / options.duration) * rect.width
  const distStart = Math.abs(clientX - toX(options.atSeconds))
  const distEnd = Math.abs(clientX - toX(options.endSeconds))
  if (distStart <= HANDLE_HIT_PX && distStart <= distEnd) return 'start'
  if (distEnd <= HANDLE_HIT_PX) return 'end'
  const x = clientX
  const left = toX(options.atSeconds)
  const right = toX(options.endSeconds)
  if (x >= left && x <= right) return 'body'
  return 'playhead'
}

/**
 * Dual-lane timeline: locked audio bed plus editable picture-insert patches.
 * @param props - Duration, patches, selection, and change callbacks.
 * @returns Interactive timeline control.
 */
export function PictureInsertsTimeline({
  duration,
  patches,
  activeId,
  playheadSeconds,
  onSelect,
  onChangePatch,
  onSeek,
}: IPictureInsertsTimelineProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ handle: TimelineHandle; id: string; grabOffset: number } | null>(null)

  const safeDuration = duration > 0 ? duration : 1
  const playPct = Math.min(100, Math.max(0, (playheadSeconds / safeDuration) * 100))
  const active = patches.find((patch) => patch.id === activeId) ?? null

  function applyPointer(clientX: number): void {
    const track = trackRef.current
    const drag = dragRef.current
    if (!track || !drag) return
    const time = timeFromClientX(clientX, track, safeDuration)
    const patch = patches.find((item) => item.id === drag.id)
    if (!patch) return
    if (drag.handle === 'playhead') {
      onSeek(time)
      return
    }
    if (drag.handle === 'start') {
      const end = patch.at_seconds + patch.duration_seconds
      const nextAt = Math.min(Math.max(0, time), end - MIN_PATCH_SECONDS)
      onChangePatch(patch.id, nextAt, Number((end - nextAt).toFixed(2)))
      onSeek(nextAt)
      return
    }
    if (drag.handle === 'end') {
      const nextEnd = Math.max(time, patch.at_seconds + MIN_PATCH_SECONDS)
      const clampedEnd = Math.min(safeDuration, nextEnd)
      onChangePatch(patch.id, patch.at_seconds, Number((clampedEnd - patch.at_seconds).toFixed(2)))
      onSeek(clampedEnd)
      return
    }
    const nextAt = Math.min(
      Math.max(0, time - drag.grabOffset),
      Math.max(0, safeDuration - patch.duration_seconds),
    )
    onChangePatch(patch.id, Number(nextAt.toFixed(2)), patch.duration_seconds)
    onSeek(Number(nextAt.toFixed(2)))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    const track = trackRef.current
    if (!track) return
    event.preventDefault()
    const time = timeFromClientX(event.clientX, track, safeDuration)
    const hit = [...patches]
      .reverse()
      .find(
        (patch) => time >= patch.at_seconds && time <= patch.at_seconds + patch.duration_seconds,
      )
    if (hit) {
      onSelect(hit.id)
      const handle =
        hit.id === activeId
          ? pickHandle(event.clientX, track, {
              duration: safeDuration,
              atSeconds: hit.at_seconds,
              endSeconds: hit.at_seconds + hit.duration_seconds,
            })
          : 'body'
      dragRef.current = {
        handle: handle === 'playhead' ? 'body' : handle,
        id: hit.id,
        grabOffset: time - hit.at_seconds,
      }
    } else {
      dragRef.current = { handle: 'playhead', id: activeId ?? '', grabOffset: 0 }
      onSeek(time)
    }
    track.setPointerCapture(event.pointerId)
    applyPointer(event.clientX)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragRef.current) return
    applyPointer(event.clientX)
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
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Audio (original, locked)
        </p>
        <div className="relative h-6 overflow-hidden rounded-lg bg-slate-200">
          <div className="absolute inset-y-1 left-1 right-1 rounded-md bg-slate-400/70" />
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-slate-700/70"
            style={{ left: `${playPct}%` }}
          />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Replaced segments
        </p>
        <div
          ref={trackRef}
          role="slider"
          aria-label="Picture inserts timeline"
          aria-valuemin={0}
          aria-valuemax={safeDuration}
          aria-valuenow={playheadSeconds}
          tabIndex={0}
          className="relative h-12 cursor-pointer touch-none rounded-xl bg-brand-mist"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {patches.map((patch) => {
            const startPct = Math.min(100, Math.max(0, (patch.at_seconds / safeDuration) * 100))
            const widthPct = Math.min(
              100 - startPct,
              Math.max(0, (patch.duration_seconds / safeDuration) * 100),
            )
            const selected = patch.id === activeId
            return (
              <div
                key={patch.id}
                className={`absolute inset-y-2 rounded-lg ${
                  selected ? 'bg-brand/55 ring-2 ring-brand/40' : 'bg-brand/30'
                }`}
                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                title={patch.label}
              />
            )
          })}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-slate-700/70"
            style={{ left: `${playPct}%` }}
          />
          {active && (
            <>
              <div
                className="absolute top-1 bottom-1 z-20 w-3 -translate-x-1/2 rounded-md border-2 border-white bg-brand shadow"
                style={{ left: `${(active.at_seconds / safeDuration) * 100}%` }}
                title="Start"
              />
              <div
                className="absolute top-1 bottom-1 z-20 w-3 -translate-x-1/2 rounded-md border-2 border-white bg-brand-ink shadow"
                style={{
                  left: `${((active.at_seconds + active.duration_seconds) / safeDuration) * 100}%`,
                }}
                title="End"
              />
            </>
          )}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>0:00</span>
        <span>Drag patch · handles resize · click bar to scrub</span>
        <span>{safeDuration.toFixed(1)}s</span>
      </div>
    </div>
  )
}
