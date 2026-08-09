'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioModeType, AudioRecorder } from '@/components/audio-recorder'
import { SegmentTimelineBar } from '@/components/segment-timeline-bar'
import type { IMediaAsset, IVideoSegment } from '@/lib/media-editor-client'
import { renderVideo, uploadAsset } from '@/lib/media-editor-client'

const MAX_SEGMENTS = 20
const MIN_SEGMENT_SECONDS = 0.1
const AUDIO_UPLOAD_ACCEPT = 'audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/webm,audio/ogg,.mp3,.wav,.m4a,.aac,.webm,.ogg'

interface IVideoEditorProps {
  asset: IMediaAsset
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

/** Full-screen studio to mark ordered segments and render one shorter MP4. */
export function VideoEditor({ asset, onClose, onSaved }: IVideoEditorProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const duration = asset.duration && asset.duration > 0 ? asset.duration : 0
  const [segments, setSegments] = useState<IEditorSegment[]>(() => {
    const first = fullClipSegment(duration || 10)
    return [{ id: crypto.randomUUID(), ...first }]
  })
  const [activeId, setActiveId] = useState<string>(() => segments[0]?.id ?? '')
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

  const active = segments.find((segment) => segment.id === activeId) ?? segments[0] ?? null
  const totalDuration = useMemo(
    () => segments.reduce((sum, segment) => sum + (segment.end_seconds - segment.start_seconds), 0),
    [segments],
  )

  useEffect(() => {
    selectionOutRef.current = active?.end_seconds ?? 0
  }, [active?.end_seconds])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !active) return
    stopSelectionWatch()
    playingSelectionRef.current = false
    video.pause()
    video.currentTime = active.start_seconds
    setPlayhead(active.start_seconds)
  }, [activeId])

  useEffect(() => {
    // Once real duration is known, expand the bootstrap single segment to the full clip
    // so narration/render does not drop the rest of a merged video.
    if (didExpandToSourceRef.current || resolvedDuration <= MIN_SEGMENT_SECONDS) return
    didExpandToSourceRef.current = true
    setSegments((current) => {
      if (current.length !== 1) return current
      const only = current[0]
      if (only.start_seconds !== 0) return current
      if (only.end_seconds + 0.05 >= resolvedDuration) return current
      return [{ ...only, end_seconds: Number(resolvedDuration.toFixed(2)) }]
    })
  }, [resolvedDuration])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    function onTimeUpdate(): void {
      enforceSelectionOut()
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
  }, [])

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

  const maxTime = resolvedDuration || Math.max(...segments.map((segment) => segment.end_seconds), 1)

  /**
   * Seek the preview player and sync the playhead label.
   * @param seconds - Target time on the source timeline.
   */
  function seekTo(seconds: number): void {
    const video = videoRef.current
    const next = Number(Math.max(0, Math.min(maxTime, seconds)).toFixed(2))
    setPlayhead(next)
    if (video) video.currentTime = next
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

  async function submit(): Promise<void> {
    if (segments.length === 0) {
      setError('Add at least one segment')
      return
    }
    for (const segment of segments) {
      if (segment.end_seconds <= segment.start_seconds) {
        setError('Each segment end must be after its start')
        return
      }
      if (resolvedDuration > 0 && segment.end_seconds > resolvedDuration + 0.05) {
        setError('A segment ends after the source duration')
        return
      }
    }
    setBusy(true)
    setError('')
    try {
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
   * @param mode - Keep, mute, record, or upload.
   */
  function changeAudioMode(mode: AudioModeType): void {
    setAudioMode(mode)
    setError('')
    if (mode !== 'record') setRecordedAudio(null)
    if (mode !== 'upload') setUploadedAudio(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-ink/90 p-3 backdrop-blur-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Video studio</p>
          <p className="font-serif text-2xl">Editing {asset.title ?? asset.original_filename}</p>
          <p className="mt-1 text-xs text-white/70">
            Starts with the full clip. Trim or add segments only if you want a shorter cut, then render.
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
          <video
            ref={videoRef}
            className="max-h-[50vh] w-full rounded-xl bg-brand-ink"
            controls
            src={asset.url}
            onPlay={() => {
              // Native control play is free playback; only Play selection arms the out-stop.
              if (!playingSelectionRef.current) stopSelectionWatch()
            }}
          />
          {active && (
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
                Playhead {formatTime(playhead)} · source {formatTime(maxTime)} · output {formatTime(totalDuration)}
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="me-label mb-0">Segments</p>
              <p className="text-sm text-slate-600">{segments.length} kept · {formatTime(totalDuration)} total</p>
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
                      {index + 1}. {formatTime(segment.start_seconds)} → {formatTime(segment.end_seconds)}
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
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`px-3 py-1.5 text-xs ${
                    audioMode === mode ? 'me-btn-primary' : 'me-btn-secondary'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  disabled={busy}
                  onClick={() => changeAudioMode(mode)}
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
