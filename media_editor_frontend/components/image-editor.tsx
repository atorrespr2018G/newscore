'use client'

import { useMemo, useState } from 'react'
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor'
import { IMediaAsset, saveImageDerivative } from '@/lib/media-editor-client'

interface IImageEditorProps {
  asset: IMediaAsset
  onClose: () => void
  onSaved: (derivative: IMediaAsset) => Promise<void>
}

/**
 * Map media-editor API URLs onto the Next.js same-origin proxy so Konva can
 * rotate/export without a cross-origin canvas taint.
 */
function toEditorSourceUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.pathname.startsWith('/media/')) {
      return `/media-editor-files${parsed.pathname.slice('/media'.length)}${parsed.search}`
    }
  } catch {
    // Fall through to the original URL when parsing fails.
  }
  return url
}

/** Render the MIT-licensed Filerobot editor exclusively in the browser. */
export function ImageEditor({ asset, onClose, onSaved }: IImageEditorProps): JSX.Element {
  const [editorKey, setEditorKey] = useState(0)
  const [error, setError] = useState('')
  const sourceUrl = useMemo(() => toEditorSourceUrl(asset.url), [asset.url])

  async function save(edited: { imageBase64?: string; imageCanvas?: HTMLCanvasElement }): Promise<void> {
    try {
      let blob: Blob | null = null
      if (edited.imageCanvas) {
        blob = await new Promise<Blob | null>((resolve) => edited.imageCanvas?.toBlob(resolve, 'image/png'))
      } else if (edited.imageBase64) {
        const response = await fetch(edited.imageBase64)
        blob = await response.blob()
      }
      if (!blob) throw new Error('Image editor did not return an export')
      const derivative = await saveImageDerivative(
        asset.id,
        new File([blob], `edited-${asset.id}.png`, { type: 'image/png' }),
      )
      await onSaved(derivative)
      onClose()
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to save edited image')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-ink/90 p-3 backdrop-blur-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Image studio</p>
          <p className="font-serif text-2xl">Editing {asset.title ?? asset.original_filename}</p>
          <p className="mt-1 text-xs text-white/70">
            Crop is selected by default. Drag the handles on the image, then save a new version.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
            type="button"
            onClick={() => {
              setError('')
              setEditorKey((value) => value + 1)
            }}
          >
            Return to default
          </button>
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-slate-100" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {error && <p className="mb-3 rounded-xl bg-brand-soft px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="filerobot-shell min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-lift">
        <FilerobotImageEditor
          key={`${asset.id}-${editorKey}`}
          source={sourceUrl}
          onClose={onClose}
          onSave={save}
          tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.FILTERS, TABS.ANNOTATE, TABS.RESIZE]}
          defaultTabId={TABS.ADJUST}
          defaultToolId={TOOLS.CROP}
          Rotate={{ angle: 90, componentType: 'buttons' }}
          Crop={{ ratio: 'original', autoResize: true, noPresets: true }}
          annotationsCommon={{ fill: '#cc0000' }}
          Text={{ text: 'NewsCore' }}
          savingPixelRatio={2}
          previewPixelRatio={typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1}
          defaultSavedImageType="png"
          closeAfterSave={false}
          observePluginContainerSize
          resetOnImageSourceChange
        />
      </div>
    </div>
  )
}
