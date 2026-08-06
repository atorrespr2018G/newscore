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
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setBusy(true)
    try {
      await onRender({
        trim_start_seconds: start,
        trim_end_seconds: end || undefined,
        title: title || undefined,
        lower_third: lowerThird || undefined,
        logo_url: logoUrl || undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-3 rounded-2xl border border-brand-line bg-brand-paper p-4" onSubmit={submit}>
      <p className="me-label mb-0">Video edit</p>
      <video className="max-h-56 w-full rounded-xl bg-brand-ink" controls src={asset.url} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="me-label" htmlFor="trim-start">Start (sec)</label>
          <input id="trim-start" className="me-input" min="0" step="0.1" type="number" value={start} onChange={(event) => setStart(Number(event.target.value))} />
        </div>
        <div>
          <label className="me-label" htmlFor="trim-end">End (sec)</label>
          <input id="trim-end" className="me-input" min="0" step="0.1" type="number" value={end} onChange={(event) => setEnd(Number(event.target.value))} />
        </div>
      </div>
      <div>
        <label className="me-label" htmlFor="video-title">Title</label>
        <input id="video-title" className="me-input" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div>
        <label className="me-label" htmlFor="lower-third">Lower third</label>
        <input id="lower-third" className="me-input" value={lowerThird} onChange={(event) => setLowerThird(event.target.value)} />
      </div>
      <div>
        <label className="me-label" htmlFor="logo-url">Logo URL</label>
        <input id="logo-url" className="me-input" type="url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
      </div>
      <button className="me-btn-primary w-full" disabled={busy} type="submit">
        {busy ? 'Rendering…' : 'Render edited video'}
      </button>
    </form>
  )
}
