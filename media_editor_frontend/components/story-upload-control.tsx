'use client'

import { ChangeEvent, useState } from 'react'
import { IMediaAsset, uploadAsset } from '@/lib/media-editor-client'

interface IStoryUploadControlProps {
  storyId: string
  onUploaded: (asset: IMediaAsset) => void
  onError: (message: string) => void
}

/**
 * Compact upload control for adding originals into a story pool panel.
 * @param props - Active story id and upload result callbacks.
 * @returns Dashed upload target rendered inside the originals collection.
 */
export function StoryUploadControl({
  storyId,
  onUploaded,
  onError,
}: IStoryUploadControlProps): JSX.Element {
  const [uploading, setUploading] = useState(false)

  async function change(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        onUploaded(await uploadAsset(file, storyId))
      }
    } catch (exception) {
      onError(exception instanceof Error ? exception.message : 'Upload failed')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-line bg-brand-paper px-4 py-3 transition hover:border-brand/40 hover:bg-brand-soft/40">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-mist text-base font-semibold text-brand-ink">
        +
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-semibold text-brand-ink">
          {uploading ? 'Uploading…' : 'Add pictures to this story'}
        </span>
        <span className="block text-xs text-slate-500">
          JPEG, PNG, WebP, MP4, WebM, or QuickTime
        </span>
      </span>
      <input
        className="sr-only"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        type="file"
        multiple
        disabled={uploading}
        onChange={(event) => void change(event)}
      />
    </label>
  )
}
