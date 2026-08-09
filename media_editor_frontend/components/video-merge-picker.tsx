'use client'

import { useMemo, useState } from 'react'
import { MediaThumb } from '@/components/media-thumb'
import type { IMediaAsset } from '@/lib/media-editor-client'

interface IVideoMergePickerProps {
  videos: IMediaAsset[]
  busy: boolean
  onClose: () => void
  onMerge: (assetIds: string[]) => Promise<void>
}

/**
 * Format a duration label for merge candidates.
 * @param seconds - Clip length in seconds, if known.
 * @returns Short human-readable duration.
 */
function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return 'video'
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const secs = whole % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/**
 * Modal to choose which videos to merge and in which order.
 * @param props - Candidate videos and merge callbacks.
 * @returns Selection dialog for multi-video merge.
 */
export function VideoMergePicker({
  videos,
  busy,
  onClose,
  onMerge,
}: IVideoMergePickerProps): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => videos.map((video) => video.id))
  const [error, setError] = useState('')

  const selectedVideos = useMemo(() => {
    const byId = new Map(videos.map((video) => [video.id, video]))
    return selectedIds
      .map((id) => byId.get(id) ?? null)
      .filter((video): video is IMediaAsset => Boolean(video))
  }, [selectedIds, videos])

  function toggleVideo(assetId: string): void {
    setError('')
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    )
  }

  function moveSelected(assetId: string, offset: -1 | 1): void {
    setSelectedIds((current) => {
      const index = current.indexOf(assetId)
      const target = index + offset
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  async function submit(): Promise<void> {
    if (selectedIds.length < 2) {
      setError('Select at least two videos to merge')
      return
    }
    setError('')
    await onMerge(selectedIds)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/80 p-4 backdrop-blur-sm">
      <div className="me-panel flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden">
        <div className="border-b border-brand-line px-5 py-4">
          <p className="me-label mb-0">Merge videos</p>
          <h2 className="font-serif text-2xl text-brand-ink">Choose clips to join</h2>
          <p className="mt-1 text-sm text-slate-500">
            Check the videos to include, reorder the selection, then merge into one file.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
          <div>
            <p className="me-label">Available videos</p>
            <ul className="space-y-2">
              {videos.map((video) => {
                const checked = selectedIds.includes(video.id)
                return (
                  <li key={video.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-line bg-white px-3 py-2 hover:border-slate-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleVideo(video.id)}
                      />
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-brand-mist">
                        <MediaThumb asset={video} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-brand-ink">
                          {video.title ?? video.original_filename}
                        </p>
                        <p className="truncate text-xs text-slate-500" title={video.description ?? undefined}>
                          {video.description || formatDuration(video.duration)}
                        </p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <p className="me-label">Merge order ({selectedVideos.length} selected)</p>
            {selectedVideos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-brand-line bg-brand-paper px-3 py-6 text-center text-sm text-slate-500">
                Select videos above to build the merge order
              </p>
            ) : (
              <ol className="space-y-2">
                {selectedVideos.map((video, index) => (
                  <li
                    key={video.id}
                    className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-paper px-3 py-2"
                  >
                    <span className="w-6 text-xs font-semibold text-slate-500">{index + 1}.</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-ink">
                      {video.title ?? video.original_filename}
                    </p>
                    <button
                      type="button"
                      className="me-btn-secondary px-2 py-1 text-xs"
                      disabled={busy || index === 0}
                      onClick={() => moveSelected(video.id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="me-btn-secondary px-2 py-1 text-xs"
                      disabled={busy || index === selectedVideos.length - 1}
                      onClick={() => moveSelected(video.id, 1)}
                    >
                      Down
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-line px-5 py-4">
          <button type="button" className="me-btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="me-btn-primary"
            disabled={busy || selectedIds.length < 2}
            onClick={() => void submit()}
          >
            {busy ? 'Merging…' : `Merge ${selectedIds.length} videos`}
          </button>
        </div>
      </div>
    </div>
  )
}
