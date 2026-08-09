'use client'

import { useEffect, useRef, useState } from 'react'

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const

export type AudioModeType = 'keep' | 'mute' | 'record' | 'upload'

interface IAudioRecorderProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  disabled?: boolean
  onRecordingChange: (file: File | null) => void
  onError: (message: string) => void
}

/**
 * Pick the first MediaRecorder MIME type supported by this browser.
 * @returns MIME string, or empty when none are available.
 */
function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return ''
  }
  return RECORDER_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

/**
 * Extension for a recorded blob based on its MIME type.
 * @param mimeType - Blob or MediaRecorder MIME.
 * @returns File extension without a leading dot.
 */
function extensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

/**
 * Mic recorder for video narration: start/stop while the studio video plays.
 * @param props - Video element ref and recording callbacks.
 * @returns Recorder controls and optional preview player.
 */
export function AudioRecorder({
  videoRef,
  disabled = false,
  onRecordingChange,
  onError,
}: IAudioRecorderProps): JSX.Element {
  const [recording, setRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      stopTracks()
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  /**
   * Stop all active microphone tracks.
   */
  function stopTracks(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  /**
   * Clear the current take and notify the parent.
   */
  function clearRecording(): void {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      // Drop onstop so abandoning a take does not create a preview File.
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    mediaRecorderRef.current = null
    stopTracks()
    setRecording(false)
    chunksRef.current = []
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
    onRecordingChange(null)
    const video = videoRef.current
    if (video) {
      video.pause()
      video.muted = false
    }
  }

  /**
   * Request the mic and begin recording while playing the studio video.
   */
  async function startRecording(): Promise<void> {
    if (disabled || recording) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('This browser cannot record audio. Use Upload audio file instead.')
      return
    }
    const mimeType = pickRecorderMimeType()
    try {
      clearRecording()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        onError('Microphone recording failed')
        clearRecording()
      }
      recorder.onstop = () => finishRecording(recorder.mimeType || mimeType || 'audio/webm')
      recorder.start(250)
      setRecording(true)
      const video = videoRef.current
      if (video) {
        // Mute picture playback so room speakers are not captured back into the take.
        video.muted = true
        video.currentTime = 0
        void video.play().catch(() => undefined)
      }
    } catch {
      stopTracks()
      onError('Microphone permission denied or unavailable')
    }
  }

  /**
   * Build a File from recorded chunks and expose a preview URL.
   * @param mimeType - MIME type reported by MediaRecorder.
   */
  function finishRecording(mimeType: string): void {
    stopTracks()
    setRecording(false)
    const blob = new Blob(chunksRef.current, { type: mimeType })
    chunksRef.current = []
    if (blob.size === 0) {
      onError('Recording was empty — try again')
      onRecordingChange(null)
      return
    }
    const extension = extensionForMime(mimeType)
    const file = new File([blob], `narration-${Date.now()}.${extension}`, { type: mimeType })
    const url = URL.createObjectURL(blob)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = url
    setPreviewUrl(url)
    onRecordingChange(file)
    const video = videoRef.current
    if (video) {
      video.pause()
      video.muted = false
    }
  }

  /**
   * Stop an in-progress recording.
   */
  function stopRecording(): void {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    const video = videoRef.current
    if (video) {
      video.pause()
      video.muted = false
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-brand-line bg-white px-3 py-3">
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button
            type="button"
            className="me-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled}
            onClick={() => void startRecording()}
          >
            Start recording
          </button>
        ) : (
          <button
            type="button"
            className="me-btn-danger px-3 py-1.5 text-xs"
            onClick={stopRecording}
          >
            Stop
          </button>
        )}
        <button
          type="button"
          className="me-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || recording || !previewUrl}
          onClick={clearRecording}
        >
          Re-record
        </button>
      </div>
      {recording && (
        <p className="text-xs font-semibold text-red-700">Recording… speak while the video plays</p>
      )}
      {previewUrl && !recording && (
        <audio className="w-full" controls src={previewUrl} />
      )}
    </div>
  )
}
