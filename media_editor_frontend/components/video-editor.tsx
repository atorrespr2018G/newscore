'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioModeType, AudioRecorder } from '@/components/audio-recorder'
import { MediaThumb } from '@/components/media-thumb'
import {
  IPicturePatch,
  PictureInsertsTimeline,
} from '@/components/picture-inserts-timeline'
import { SegmentTimelineBar } from '@/components/segment-timeline-bar'
import type { IMediaAsset, IVideoSegment } from '@/lib/media-editor-client'
import { renderVideo, uploadAsset } from '@/lib/media-editor-client'

const MAX_SEGMENTS = 20
const MAX_PATCHES = 20
const MIN_SEGMENT_SECONDS = 0.1
const AUDIO_UPLOAD_ACCEPT =
  'audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/webm,audio/ogg,.mp3,.wav,.m4a,.aac,.webm,.ogg'

type EditorModeType = 'cut' | 'picture'

interface IVideoEditorProps {
  asset: IMediaAsset
  candidateMedia: IMediaAsset[]
  onClose: () => void
  onSaved: (derivative: IMediaAsset) => Promise<void>
}

interface IEditorSegment extends IVideoSegment {
  id: string
}

/**
 * Format seconds as m:ss.d for newsroom trim labels.
 * @param seconds - Time in seconds.
 * @returns Compact timestamp string.
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0'
  const whole = Math.floor(seconds)
  const tenths = Math.floor((seconds - whole) * 10)
  const minutes = Math.floor(whole / 60)
  const secs = whole % 60
  return `${minutes}:${String(secs).padStart(2, '0')}.${tenths}`
}

/**
 * Build a segment covering the entire source clip.
 * @param duration - Source duration in seconds.
 * @returns Inclusive time range from 0 to duration.
 */
function fullClipSegment(duration: number): IVideoSegment {
  const end = duration > MIN_SEGMENT_SECONDS ? duration : Math.max(duration, MIN_SEGMENT_SECONDS)
  return { start_seconds: 0, end_seconds: Number(end.toFixed(2)) }
}

/**
 * Build a short segment around the playhead when adding another keep-range.
 * @param duration - Source duration in seconds.
 * @param playhead - Current video time.
 * @returns Inclusive time range.
 */
function defaultSegment(duration: number, playhead: number): IVideoSegment {
  if (duration <= MIN_SEGMENT_SECONDS) {
    return { start_seconds: 0, end_seconds: Math.max(duration, MIN_SEGMENT_SECONDS) }
  }
  const start = Math.min(Math.max(0, playhead), Math.max(0, duration - MIN_SEGMENT_SECONDS))
  const end = Math.min(duration, Math.max(start + Math.min(5, duration), start + MIN_SEGMENT_SECONDS))
  return { start_seconds: Number(start.toFixed(2)), end_seconds: Number(end.toFixed(2)) }
}

/**
 * Find the picture patch covering a timeline time, if any.
 * @param patches - Current picture inserts.
 * @param time - Playhead on the base timeline.
 * @returns Matching patch or null.
 */
function patchAtTime(patches: IPicturePatch[], time: number): IPicturePatch | null {
  return (
    patches.find(
      (patch) => time + 0.001 >= patch.at_seconds && time < patch.at_seconds + patch.duration_seconds,
    ) ?? null
  )
}

/**
 * Check whether two picture windows overlap.
 * @param a - First patch.
 * @param b - Second patch.
 * @returns True when ranges overlap.
 */
function patchesOverlap(a: IPicturePatch, b: IPicturePatch): boolean {
  const aEnd = a.at_seconds + a.duration_seconds
  const bEnd = b.at_seconds + b.duration_seconds
  return a.at_seconds < bEnd - 0.001 && b.at_seconds < aEnd - 0.001
}

/** Full-screen studio for cut packages or picture inserts under locked audio. */
export function VideoEditor({
  asset,
  candidateMedia,
  onClose,
  onSaved,
}: IVideoEditorProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null)
  const duration = asset.duration && asset.duration > 0 ? asset.duration : 0
  const [mode, setMode] = useState<EditorModeType>('cut')
  const [segments, setSegments] = useState<IEditorSegment[]>(() => {
    const first = fullClipSegment(duration || 10)
    return [{ id: crypto.randomUUID(), ...first }]
  })
  const [activeId, setActiveId] = useState<string>(() => segments[0]?.id ?? '')
  const [patches, setPatches] = useState<IPicturePatch[]>([])
  const [activePatchId, setActivePatchId] = useState<string>('')
  const [pickerAssetId, setPickerAssetId] = useState<string>(() => candidateMedia[0]?.id ?? '')
  const [replaceIn, setReplaceIn] = useState(0)
  const [replaceOut, setReplaceOut] = useState(() =>
    Number(Math.max(MIN_SEGMENT_SECONDS, Math.min(duration || 5, 5)).toFixed(2)),
  )
  const [playhead, setPlayhead] = useState(0)
  const [resolvedDuration, setResolvedDuration] = useState(duration)
  const didExpandToSourceRef = useRef(false)
  const [title, setTitle] = useState('')
  const [lowerThird, setLowerThird] = useState('')
  const [audioMode, setAudioMode] = useState<AudioModeType>('keep')
  const [recordedAudio, setRecordedAudio] = useState<File | null>(null)
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const playingSelectionRef = useRef(false)
  const selectionOutRef = useRef(0)
  const selectionWatchRef = useRef<number | null>(null)
  const candidatesById = useMemo(() => {
    const map = new Map<string, IMediaAsset>()
    for (const media of candidateMedia) map.set(media.id, media)
    return map
  }, [candidateMedia])
  const coveringPatch = mode === 'picture' ? patchAtTime(patches, playhead) : null
  const coveringMedia = coveringPatch ? candidatesById.get(coveringPatch.source_asset_id) ?? null : null

  const active = segments.find((segment) => segment.id === activeId) ?? segments[0] ?? null
  const activePatch = patches.find((patch) => patch.id === activePatchId) ?? patches[0] ?? null
  const totalDuration = useMemo(
    () => segments.reduce((sum, segment) => sum + (segment.end_seconds - segment.start_seconds), 0),
    [segments],
  )
  const maxTime = resolvedDuration || Math.max(...segments.map((segment) => segment.end_seconds), 1)

  useEffect(() => {
    selectionOutRef.current = active?.end_seconds ?? 0
  }, [active?.end_seconds])

  useEffect(() => {
    if (mode !== 'cut') return
    const video = videoRef.current
    if (!video || !active) return
    stopSelectionWatch()
    playingSelectionRef.current = false
    video.pause()
    video.currentTime = active.start_seconds
    setPlayhead(active.start_seconds)
  }, [activeId, mode])

  useEffect(() => {
    if (didExpandToSourceRef.current || resolvedDuration <= MIN_SEGMENT_SECONDS) return
    didExpandToSourceRef.current = true
    setSegments((current) => {
      if (current.length !== 1) return current
      const only = current[0]
      if (only.start_seconds !== 0) return current
      if (only.end_seconds + 0.05 >= resolvedDuration) return current
      return [{ ...only, end_seconds: Number(resolvedDuration.toFixed(2)) }]
    })
    setReplaceOut((current) => {
      if (current <= resolvedDuration) return current
      return Number(Math.min(resolvedDuration, Math.max(MIN_SEGMENT_SECONDS, 5)).toFixed(2))
    })
  }, [resolvedDuration])

  useEffect(() => {
    if (!pickerAssetId && candidateMedia[0]) {
      setPickerAssetId(candidateMedia[0].id)
    }
  }, [candidateMedia, pickerAssetId])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    function onTimeUpdate(): void {
      if (mode === 'cut' || playingSelectionRef.current) {
        enforceSelectionOut()
        if (mode === 'picture') {
          const time = videoRef.current?.currentTime ?? 0
          syncOverlayToPlayhead(time)
        }
        return
      }
      if (mode === 'picture') {
        const time = videoRef.current?.currentTime ?? 0
        setPlayhead(time)
        syncOverlayToPlayhead(time)
      }
    }
    function onLoaded(): void {
      if (!videoRef.current) return
      const next = videoRef.current.duration
      if (Number.isFinite(next) && next > 0) setResolvedDuration(next)
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onLoaded)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onLoaded)
      stopSelectionWatch()
    }
  }, [mode, patches])

  useEffect(() => {
    if (mode !== 'picture') return
    const base = videoRef.current
    if (base) base.muted = false
    syncOverlayToPlayhead(playhead)
  }, [mode, coveringPatch?.id, coveringMedia?.id])

  /** Cancel the high-frequency Play selection watch loop. */
  function stopSelectionWatch(): void {
    if (selectionWatchRef.current != null) {
      window.cancelAnimationFrame(selectionWatchRef.current)
      selectionWatchRef.current = null
    }
  }

  /** Pause at Set out while Play selection is active. */
  function enforceSelectionOut(): void {
    const el = videoRef.current
    if (!el) return
    const time = el.currentTime
    setPlayhead(time)
    if (!playingSelectionRef.current) return
    if (time + 0.02 < selectionOutRef.current) return
    playingSelectionRef.current = false
    stopSelectionWatch()
    el.pause()
    el.currentTime = selectionOutRef.current
    setPlayhead(selectionOutRef.current)
  }

  /** Poll currentTime so short segments still stop on Set out. */
  function startSelectionWatch(): void {
    stopSelectionWatch()
    const tick = (): void => {
      enforceSelectionOut()
      if (playingSelectionRef.current) {
        selectionWatchRef.current = window.requestAnimationFrame(tick)
      }
    }
    selectionWatchRef.current = window.requestAnimationFrame(tick)
  }

  /**
   * Sync the muted insert overlay to the base playhead (base audio keeps playing).
   * @param timelineSeconds - Time on the base clip.
   */
  function syncOverlayToPlayhead(timelineSeconds: number): void {
    const overlay = overlayVideoRef.current
    const covering = patchAtTime(patches, timelineSeconds)
    if (!overlay || !covering) return
    const media = candidatesById.get(covering.source_asset_id)
    if (!media || media.file_type !== 'video') return
    const localTime = covering.source_in_seconds + (timelineSeconds - covering.at_seconds)
    if (Math.abs(overlay.currentTime - localTime) > 0.25) {
      overlay.currentTime = Math.max(0, localTime)
    }
    if (videoRef.current && !videoRef.current.paused && overlay.paused) {
      void overlay.play().catch(() => undefined)
    }
    if (videoRef.current?.paused && !overlay.paused) {
      overlay.pause()
    }
  }

  function updateActive(patch: Partial<IVideoSegment>): void {
    if (!active) return
    setSegments((current) =>
      current.map((segment) => {
        if (segment.id !== active.id) return segment
        const start = patch.start_seconds ?? segment.start_seconds
        const end = patch.end_seconds ?? segment.end_seconds
        return {
          ...segment,
          start_seconds: Number(Math.max(0, start).toFixed(2)),
          end_seconds: Number(Math.max(start + MIN_SEGMENT_SECONDS, end).toFixed(2)),
        }
      }),
    )
  }

  function addSegment(): void {
    if (segments.length >= MAX_SEGMENTS) {
      setError(`Maximum of ${MAX_SEGMENTS} segments`)
      return
    }
    const next = { id: crypto.randomUUID(), ...defaultSegment(resolvedDuration || 10, playhead) }
    setSegments((current) => [...current, next])
    setActiveId(next.id)
    setError('')
  }

  function removeActive(): void {
    if (segments.length <= 1 || !active) return
    const remaining = segments.filter((segment) => segment.id !== active.id)
    setSegments(remaining)
    setActiveId(remaining[0].id)
  }

  function moveActive(offset: -1 | 1): void {
    if (!active) return
    const index = segments.findIndex((segment) => segment.id === active.id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= segments.length) return
    setSegments((current) => {
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.splice(target, 0, item)
      return copy
    })
  }

  function playSelection(): void {
    const video = videoRef.current
    if (!video || !active) return
    selectionOutRef.current = active.end_seconds
    playingSelectionRef.current = true
    video.pause()
    video.currentTime = active.start_seconds
    setPlayhead(active.start_seconds)
    startSelectionWatch()
    void video.play().catch(() => {
      playingSelectionRef.current = false
      stopSelectionWatch()
    })
  }

  /**
   * Seek the preview player and sync the playhead label.
   * @param seconds - Target time on the source timeline.
   */
  function seekTo(seconds: number): void {
    const next = Number(Math.max(0, Math.min(maxTime, seconds)).toFixed(2))
    setPlayhead(next)
    const video = videoRef.current
    if (video) video.currentTime = next
    if (mode === 'picture') syncOverlayToPlayhead(next)
  }

  /**
   * Upload a replacement soundtrack when the studio is in record or upload mode.
   * @returns Audio asset id, or undefined when keeping/muting original audio.
   */
  async function resolveReplacementAudioId(): Promise<string | undefined> {
    if (audioMode === 'record') {
      if (!recordedAudio) throw new Error('Record narration before rendering, or choose Keep original')
      const uploaded = await uploadAsset(recordedAudio)
      return uploaded.id
    }
    if (audioMode === 'upload') {
      if (!uploadedAudio) throw new Error('Choose an audio file before rendering, or choose Keep original')
      const uploaded = await uploadAsset(uploadedAudio)
      return uploaded.id
    }
    return undefined
  }

  /**
   * Replace the marked base segment's picture with the selected image or video.
   * @param assetId - Optional media id; defaults to the thumbnail selection.
   */
  function replaceMarkedSegment(assetId?: string): void {
    const chosenId = assetId ?? pickerAssetId
    const selected = candidatesById.get(chosenId)
    if (!selected) {
      setError('Choose an image or video from Report order')
      return
    }
    setPickerAssetId(selected.id)
    const start = Number(Math.max(0, Math.min(replaceIn, replaceOut)).toFixed(2))
    const end = Number(Math.max(replaceIn, replaceOut).toFixed(2))
    const durationSeconds = Number((end - start).toFixed(2))
    if (durationSeconds < MIN_SEGMENT_SECONDS) {
      setError('Mark a segment with Set in / Set out before replacing')
      return
    }
    if (end > maxTime + 0.05) {
      setError('Replacement segment ends after the source duration')
      return
    }
    const next: IPicturePatch = {
      id: crypto.randomUUID(),
      at_seconds: start,
      duration_seconds: durationSeconds,
      source_asset_id: selected.id,
      source_in_seconds: 0,
      label: selected.title ?? selected.original_filename,
    }
    const withoutOverlap = patches.filter((patch) => !patchesOverlap(patch, next))
    if (withoutOverlap.length >= MAX_PATCHES) {
      setError(`Maximum of ${MAX_PATCHES} replaced segments`)
      return
    }
    setPatches([...withoutOverlap, next].sort((a, b) => a.at_seconds - b.at_seconds))
    setActivePatchId(next.id)
    setReplaceIn(start)
    setReplaceOut(end)
    setError('')
  }

  /** Play the marked replace segment on the base timeline. */
  function playReplaceSelection(): void {
    const video = videoRef.current
    if (!video) return
    selectionOutRef.current = replaceOut
    playingSelectionRef.current = true
    video.pause()
    video.currentTime = replaceIn
    setPlayhead(replaceIn)
    startSelectionWatch()
    void video.play().catch(() => {
      playingSelectionRef.current = false
      stopSelectionWatch()
    })
  }

  /**
   * Update one picture patch window after timeline drag.
   * @param id - Patch id.
   * @param atSeconds - New start on the base timeline.
   * @param durationSeconds - New window length.
   */
  function changePicturePatch(id: string, atSeconds: number, durationSeconds: number): void {
    setPatches((current) => {
      const next = current.map((patch) => {
        if (patch.id !== id) return patch
        return {
          ...patch,
          at_seconds: Number(Math.max(0, atSeconds).toFixed(2)),
          duration_seconds: Number(Math.max(MIN_SEGMENT_SECONDS, durationSeconds).toFixed(2)),
        }
      })
      const updated = next.find((patch) => patch.id === id)
      if (!updated) return current
      if (updated.at_seconds + updated.duration_seconds > maxTime + 0.05) {
        setError('Picture insert ends after the source duration')
        return current
      }
      if (next.some((patch) => patch.id !== id && patchesOverlap(patch, updated))) {
        setError('Picture inserts cannot overlap')
        return current
      }
      setError('')
      return next.sort((a, b) => a.at_seconds - b.at_seconds)
    })
  }

  function removeActivePatch(): void {
    if (!activePatch) return
    const remaining = patches.filter((patch) => patch.id !== activePatch.id)
    setPatches(remaining)
    setActivePatchId(remaining[0]?.id ?? '')
  }

  /**
   * Switch studio mode and reset preview to the base clip.
   * @param nextMode - Cut segments or picture inserts.
   */
  function changeMode(nextMode: EditorModeType): void {
    setMode(nextMode)
    setError('')
    stopSelectionWatch()
    playingSelectionRef.current = false
    const video = videoRef.current
    if (video) {
      video.muted = false
      video.pause()
      video.currentTime = 0
    }
    const overlay = overlayVideoRef.current
    if (overlay) {
      overlay.pause()
      overlay.removeAttribute('src')
      overlay.load()
    }
    setPlayhead(0)
  }

  async function submit(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      if (mode === 'picture') {
        if (patches.length === 0) {
          throw new Error('Replace at least one segment before rendering')
        }
        for (const patch of patches) {
          if (patch.duration_seconds <= 0) {
            throw new Error('Each replaced segment needs a positive duration')
          }
          if (resolvedDuration > 0 && patch.at_seconds + patch.duration_seconds > resolvedDuration + 0.05) {
            throw new Error('A replaced segment ends after the source duration')
          }
          const media = candidatesById.get(patch.source_asset_id)
          if (!media) throw new Error('A replaced segment references missing story media')
        }
        for (let index = 0; index < patches.length; index += 1) {
          for (let other = index + 1; other < patches.length; other += 1) {
            if (patchesOverlap(patches[index], patches[other])) {
              throw new Error('Replaced segments cannot overlap')
            }
          }
        }
        const derivative = await renderVideo(asset.id, {
          picture_replacements: patches.map((patch) => ({
            at_seconds: patch.at_seconds,
            duration_seconds: patch.duration_seconds,
            source_asset_id: patch.source_asset_id,
            source_in_seconds: patch.source_in_seconds,
          })),
          title: title.trim() || undefined,
          lower_third: lowerThird.trim() || undefined,
        })
        await onSaved(derivative)
        onClose()
        return
      }

      if (segments.length === 0) {
        throw new Error('Add at least one segment')
      }
      for (const segment of segments) {
        if (segment.end_seconds <= segment.start_seconds) {
          throw new Error('Each segment end must be after its start')
        }
        if (resolvedDuration > 0 && segment.end_seconds > resolvedDuration + 0.05) {
          throw new Error('A segment ends after the source duration')
        }
      }
      const replaceAudioId = await resolveReplacementAudioId()
      const derivative = await renderVideo(asset.id, {
        segments: segments.map(({ start_seconds, end_seconds }) => ({ start_seconds, end_seconds })),
        title: title.trim() || undefined,
        lower_third: lowerThird.trim() || undefined,
        mute_audio: audioMode === 'mute',
        replace_audio_asset_id: replaceAudioId,
      })
      await onSaved(derivative)
      onClose()
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Video render failed')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Switch audio mode and clear takes that no longer apply.
   * @param next - Keep, mute, record, or upload.
   */
  function changeAudioMode(next: AudioModeType): void {
    setAudioMode(next)
    setError('')
    if (next !== 'record') setRecordedAudio(null)
    if (next !== 'upload') setUploadedAudio(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-ink/90 p-3 backdrop-blur-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Video studio</p>
          <p className="font-serif text-2xl">Editing {asset.title ?? asset.original_filename}</p>
          <p className="mt-1 text-xs text-white/70">
            {mode === 'cut'
              ? 'Starts with the full clip. Trim or add segments only if you want a shorter cut, then render.'
              : 'Mark a segment, pick a Report-order image or video, and replace that picture. Base audio stays for the full length.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="me-btn-primary" type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Rendering…' : 'Render video'}
          </button>
        </div>
      </div>

      <div className="me-panel grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['cut', 'Cut segments'],
                ['picture', 'Replace picture'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`px-3 py-1.5 text-xs ${
                  mode === value ? 'me-btn-primary' : 'me-btn-secondary'
                }`}
                disabled={busy}
                onClick={() => changeMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative max-h-[50vh] overflow-hidden rounded-xl bg-brand-ink">
            <video
              ref={videoRef}
              className="max-h-[50vh] w-full"
              controls
              src={asset.url}
              onPlay={() => {
                if (mode === 'cut' && !playingSelectionRef.current) stopSelectionWatch()
                if (mode === 'picture') {
                  const overlay = overlayVideoRef.current
                  if (overlay && coveringMedia?.file_type === 'video') {
                    void overlay.play().catch(() => undefined)
                  }
                }
              }}
              onPause={() => {
                overlayVideoRef.current?.pause()
              }}
            />
            {mode === 'picture' && coveringMedia?.file_type === 'image' && (
              <img
                src={coveringMedia.preview_url || coveringMedia.url}
                alt={coveringMedia.title ?? coveringMedia.original_filename}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            )}
            {mode === 'picture' && coveringMedia?.file_type === 'video' && coveringPatch && (
              <video
                ref={overlayVideoRef}
                key={coveringPatch.id}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                src={coveringMedia.url}
                muted
                playsInline
                onLoadedData={() => syncOverlayToPlayhead(playhead)}
              />
            )}
          </div>
          {mode === 'cut' && active && (
            <div className="space-y-3 rounded-xl border border-brand-line bg-brand-paper p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Active segment · {formatTime(active.end_seconds - active.start_seconds)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="me-btn-secondary px-3 py-1.5 text-xs" onClick={playSelection}>
                    Play selection
                  </button>
                  <button
                    type="button"
                    className="me-btn-secondary px-3 py-1.5 text-xs"
                    onClick={() => updateActive({ start_seconds: playhead })}
                  >
                    Set in
                  </button>
                  <button
                    type="button"
                    className="me-btn-secondary px-3 py-1.5 text-xs"
                    onClick={() => updateActive({ end_seconds: playhead })}
                  >
                    Set out
                  </button>
                </div>
              </div>
              <SegmentTimelineBar
                duration={maxTime}
                startSeconds={active.start_seconds}
                endSeconds={active.end_seconds}
                playheadSeconds={playhead}
                onChangeRange={(startSeconds, endSeconds) => {
                  updateActive({ start_seconds: startSeconds, end_seconds: endSeconds })
                }}
                onSeek={seekTo}
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="me-label">In (sec)</span>
                  <input
                    className="me-input"
                    type="number"
                    min={0}
                    max={maxTime}
                    step={0.1}
                    value={active.start_seconds}
                    onChange={(event) => updateActive({ start_seconds: Number(event.target.value) })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="me-label">Out (sec)</span>
                  <input
                    className="me-input"
                    type="number"
                    min={0}
                    max={maxTime}
                    step={0.1}
                    value={active.end_seconds}
                    onChange={(event) => updateActive({ end_seconds: Number(event.target.value) })}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Playhead {formatTime(playhead)} · source {formatTime(maxTime)} · output{' '}
                {formatTime(totalDuration)}
              </p>
            </div>
          )}
          {mode === 'picture' && (
            <div className="space-y-3 rounded-xl border border-brand-line bg-brand-paper p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Segment to replace · {formatTime(Math.max(0, replaceOut - replaceIn))} · audio
                  locked
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="me-btn-secondary px-3 py-1.5 text-xs"
                    onClick={playReplaceSelection}
                  >
                    Play segment
                  </button>
                  <button
                    type="button"
                    className="me-btn-secondary px-3 py-1.5 text-xs"
                    onClick={() => {
                      setReplaceIn(Number(playhead.toFixed(2)))
                      if (playhead >= replaceOut - MIN_SEGMENT_SECONDS) {
                        setReplaceOut(
                          Number(Math.min(maxTime, playhead + MIN_SEGMENT_SECONDS).toFixed(2)),
                        )
                      }
                    }}
                  >
                    Set in
                  </button>
                  <button
                    type="button"
                    className="me-btn-secondary px-3 py-1.5 text-xs"
                    onClick={() => {
                      setReplaceOut(Number(playhead.toFixed(2)))
                      if (playhead <= replaceIn + MIN_SEGMENT_SECONDS) {
                        setReplaceIn(
                          Number(Math.max(0, playhead - MIN_SEGMENT_SECONDS).toFixed(2)),
                        )
                      }
                    }}
                  >
                    Set out
                  </button>
                </div>
              </div>
              <SegmentTimelineBar
                duration={maxTime}
                startSeconds={replaceIn}
                endSeconds={replaceOut}
                playheadSeconds={playhead}
                onChangeRange={(startSeconds, endSeconds) => {
                  setReplaceIn(startSeconds)
                  setReplaceOut(endSeconds)
                }}
                onSeek={seekTo}
              />
              <PictureInsertsTimeline
                duration={maxTime}
                patches={patches}
                activeId={activePatch?.id ?? null}
                playheadSeconds={playhead}
                onSelect={(id) => {
                  setActivePatchId(id)
                  const patch = patches.find((item) => item.id === id)
                  if (!patch) return
                  setReplaceIn(patch.at_seconds)
                  setReplaceOut(
                    Number((patch.at_seconds + patch.duration_seconds).toFixed(2)),
                  )
                  setPickerAssetId(patch.source_asset_id)
                  seekTo(patch.at_seconds)
                }}
                onChangePatch={(id, atSeconds, durationSeconds) => {
                  changePicturePatch(id, atSeconds, durationSeconds)
                  if (id === activePatchId) {
                    setReplaceIn(atSeconds)
                    setReplaceOut(Number((atSeconds + durationSeconds).toFixed(2)))
                  }
                }}
                onSeek={seekTo}
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="me-label">Replace from (sec)</span>
                  <input
                    className="me-input"
                    type="number"
                    min={0}
                    max={maxTime}
                    step={0.1}
                    value={replaceIn}
                    onChange={(event) => setReplaceIn(Number(event.target.value))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="me-label">Replace to (sec)</span>
                  <input
                    className="me-input"
                    type="number"
                    min={0}
                    max={maxTime}
                    step={0.1}
                    value={replaceOut}
                    onChange={(event) => setReplaceOut(Number(event.target.value))}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Playhead {formatTime(playhead)} · chosen media replaces this segment&apos;s picture
                only
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          {mode === 'cut' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="me-label mb-0">Segments</p>
                  <p className="text-sm text-slate-600">
                    {segments.length} kept · {formatTime(totalDuration)} total
                  </p>
                </div>
                <button type="button" className="me-btn-primary px-3 py-1.5 text-xs" onClick={addSegment}>
                  Add segment
                </button>
              </div>
              <ul className="min-h-0 flex-1 space-y-2 overflow-auto">
                {segments.map((segment, index) => {
                  const selected = segment.id === active?.id
                  return (
                    <li key={segment.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                          selected
                            ? 'border-brand bg-brand-soft shadow-lift ring-2 ring-brand/15'
                            : 'border-brand-line bg-white hover:border-slate-300'
                        }`}
                        onClick={() => setActiveId(segment.id)}
                      >
                        <p className="text-sm font-semibold text-brand-ink">
                          {index + 1}. {formatTime(segment.start_seconds)} →{' '}
                          {formatTime(segment.end_seconds)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Keep {formatTime(segment.end_seconds - segment.start_seconds)}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="me-btn-secondary px-3 py-1.5 text-xs" onClick={() => moveActive(-1)}>
                  Move up
                </button>
                <button type="button" className="me-btn-secondary px-3 py-1.5 text-xs" onClick={() => moveActive(1)}>
                  Move down
                </button>
                <button
                  type="button"
                  className="me-btn-danger px-3 py-1.5 text-xs"
                  disabled={segments.length <= 1}
                  onClick={removeActive}
                >
                  Remove
                </button>
              </div>
              <div className="space-y-2 border-t border-brand-line pt-3">
                <p className="me-label mb-0">Audio</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['keep', 'Keep original'],
                      ['mute', 'Mute'],
                      ['record', 'Record narration'],
                      ['upload', 'Upload audio'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`px-3 py-1.5 text-xs ${
                        audioMode === value ? 'me-btn-primary' : 'me-btn-secondary'
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                      disabled={busy}
                      onClick={() => changeAudioMode(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {audioMode === 'mute' && (
                  <p className="text-xs text-slate-500">Rendered video will have no soundtrack.</p>
                )}
                {audioMode === 'record' && (
                  <AudioRecorder
                    videoRef={videoRef}
                    disabled={busy}
                    onRecordingChange={setRecordedAudio}
                    onError={setError}
                  />
                )}
                {audioMode === 'upload' && (
                  <label className="block text-sm">
                    <span className="me-label">Audio file</span>
                    <input
                      className="me-input"
                      type="file"
                      accept={AUDIO_UPLOAD_ACCEPT}
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setUploadedAudio(file)
                      }}
                    />
                    {uploadedAudio && (
                      <p className="mt-1 text-xs text-slate-500">Selected: {uploadedAudio.name}</p>
                    )}
                  </label>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="me-label mb-0">Replace picture</p>
                  <p className="text-sm text-slate-600">
                    {patches.length} replaced · audio stays original
                  </p>
                </div>
              </div>
              {candidateMedia.length === 0 ? (
                <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-slate-700">
                  Add images or videos to Report order to replace a base segment.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="me-label mb-0">Report order — pick replacement</p>
                  <div className="grid max-h-56 grid-cols-3 gap-2 overflow-auto pr-1 sm:grid-cols-4">
                    {candidateMedia.map((media, index) => {
                      const selected = media.id === pickerAssetId
                      return (
                        <button
                          key={media.id}
                          type="button"
                          disabled={busy}
                          title={media.title ?? media.original_filename}
                          className={`relative aspect-video overflow-hidden rounded-lg border text-left transition ${
                            selected
                              ? 'border-brand ring-2 ring-brand/30'
                              : 'border-brand-line hover:border-slate-300'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                          onClick={() => {
                            setPickerAssetId(media.id)
                            setError('')
                          }}
                          onDoubleClick={() => replaceMarkedSegment(media.id)}
                        >
                          <MediaThumb asset={media} />
                          <span className="absolute left-1 top-1 rounded bg-brand-ink/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {index + 1}
                          </span>
                          <span className="absolute bottom-1 right-1 rounded bg-brand-ink/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                            {media.file_type === 'image' ? 'Img' : 'Vid'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    className="me-btn-primary px-3 py-1.5 text-xs"
                    disabled={busy || !pickerAssetId}
                    onClick={() => replaceMarkedSegment()}
                  >
                    Replace marked segment
                  </button>
                </div>
              )}
              <ul className="min-h-0 flex-1 space-y-2 overflow-auto">
                {patches.map((patch, index) => {
                  const selected = patch.id === activePatch?.id
                  const media = candidatesById.get(patch.source_asset_id)
                  const endSeconds = patch.at_seconds + patch.duration_seconds
                  return (
                    <li key={patch.id}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left transition ${
                          selected
                            ? 'border-brand bg-brand-soft shadow-lift ring-2 ring-brand/15'
                            : 'border-brand-line bg-white hover:border-slate-300'
                        }`}
                        onClick={() => {
                          setActivePatchId(patch.id)
                          setReplaceIn(patch.at_seconds)
                          setReplaceOut(Number(endSeconds.toFixed(2)))
                          setPickerAssetId(patch.source_asset_id)
                          seekTo(patch.at_seconds)
                        }}
                      >
                        <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-brand-mist">
                          {media ? (
                            <MediaThumb asset={media} />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
                              Missing
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-brand-ink">
                            {index + 1}. {patch.label}
                          </p>
                          <p className="text-xs text-slate-500">
                            Replaces {formatTime(patch.at_seconds)} → {formatTime(endSeconds)}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                className="me-btn-danger px-3 py-1.5 text-xs"
                disabled={!activePatch || busy}
                onClick={removeActivePatch}
              >
                Remove replacement
              </button>
              <p className="text-xs text-slate-500">
                The chosen media replaces that segment&apos;s picture. Base audio is unchanged.
              </p>
            </>
          )}
          <div className="space-y-2 border-t border-brand-line pt-3">
            <p className="me-label mb-0">Optional overlays</p>
            <input
              className="me-input"
              placeholder="Title burn-in"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <input
              className="me-input"
              placeholder="Lower third"
              value={lowerThird}
              onChange={(event) => setLowerThird(event.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
