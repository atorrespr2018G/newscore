'use client'

import { useState } from 'react'
import type { IMediaAsset } from '@/lib/media-editor-client'

interface IVideoEditorProps {
  asset: IMediaAsset
  onRender: (instruction: {
    trim_start_seconds: number
    trim_end_seconds?: number
    title?: string
    lower_third?: string
    logo_url?: string
  }) => Promise<void>
}

/** Capture basic newsroom video edit instructions for backend FFmpeg rendering. */
export function VideoEditor({ asset, onRender }: IVideoEditorProps): JSX.Element {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(asset.duration ?? 0)
  const [title, setTitle] = useState('')
  const [lowerThird, setLowerThird] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    await onRender({
      trim_start_seconds: start,
      trim_end_seconds: end || undefined,
      title: title || undefined,
      lower_third: lowerThird || undefined,
      logo_url: logoUrl || undefined,
    })
  }

  return (
    <form className="space-y-3 rounded border p-4" onSubmit={submit}>
      <video className="max-h-72 w-full bg-black" controls src={asset.url} />
      <label className="block">Start (seconds)<input className="ml-2 border" min="0" step="0.1" type="number" value={start} onChange={(event) => setStart(Number(event.target.value))} /></label>
      <label className="block">End (seconds)<input className="ml-2 border" min="0" step="0.1" type="number" value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label>
      <label className="block">Title<input className="ml-2 border" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="block">Lower third<input className="ml-2 border" value={lowerThird} onChange={(event) => setLowerThird(event.target.value)} /></label>
      <label className="block">Logo URL<input className="ml-2 border" type="url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></label>
      <button className="rounded bg-slate-900 px-3 py-2 text-white" type="submit">Render edited video</button>
    </form>
  )
}
