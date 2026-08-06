'use client'

import { useEffect, useMemo, useState } from 'react'
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor'
import { EdgeCropControls } from '@/components/edge-crop-controls'
import {
  clampEdgeInsets,
  cropImageByEdges,
  hasEdgeCrop,
  IEdgeCropInsets,
  IImageSize,
  readImageSize,
} from '@/lib/edge-crop'
import { IMediaAsset, saveImageDerivative } from '@/lib/media-editor-client'

interface IImageEditorProps {
  asset: IMediaAsset
  onClose: () => void
  onSaved: (derivative: IMediaAsset) => Promise<void>
}

const EMPTY_INSETS: IEdgeCropInsets = { left: 0, right: 0, top: 0, bottom: 0 }

/**
 * Map media-editor API URLs onto the Next.js same-origin proxy so Konva can
 * rotate/export without a cross-origin canvas taint.
 * @param url - Absolute or relative media URL.
 * @returns Same-origin proxy path when the URL is under /media/.
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
  const [edgeBusy, setEdgeBusy] = useState(false)
  const [insets, setInsets] = useState<IEdgeCropInsets>(EMPTY_INSETS)
  const [imageSize, setImageSize] = useState<IImageSize | null>(null)
  const [workingUrl, setWorkingUrl] = useState<string | null>(null)
  const baseSourceUrl = useMemo(() => toEditorSourceUrl(asset.url), [asset.url])
  const sourceUrl = workingUrl ?? baseSourceUrl

  useEffect(() => {
    let cancelled = false
    void readImageSize(baseSourceUrl)
      .then((size) => {
        if (!cancelled) setImageSize(size)
      })
      .catch((exception) => {
        if (!cancelled) {
          setError(exception instanceof Error ? exception.message : 'Unable to read image size')
        }
      })
    return () => {
      cancelled = true
    }
  }, [baseSourceUrl])

  useEffect(() => {
    return () => {
      if (workingUrl) URL.revokeObjectURL(workingUrl)
    }
  }, [workingUrl])

  async function save(edited: { imageBase64?: string; imageCanvas?: HTMLCanvasElement }): Promise<void> {
    try {
      const blob = await exportEditedBlob(edited)
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

  async function applyEdgeCrop(): Promise<void> {
    if (!imageSize) return
    const safe = clampEdgeInsets(imageSize, insets)
    if (!hasEdgeCrop(safe)) {
      setError('Set at least one edge (left, right, top, or bottom) before applying')
      return
    }
    setEdgeBusy(true)
    setError('')
    try {
      const blob = await cropImageByEdges(sourceUrl, safe)
      const nextUrl = URL.createObjectURL(blob)
      if (workingUrl) URL.revokeObjectURL(workingUrl)
      setWorkingUrl(nextUrl)
      setInsets(EMPTY_INSETS)
      setImageSize(await readImageSize(nextUrl))
      setEditorKey((value) => value + 1)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Edge crop failed')
    } finally {
      setEdgeBusy(false)
    }
  }

  function resetEditor(): void {
    setError('')
    setInsets(EMPTY_INSETS)
    if (workingUrl) URL.revokeObjectURL(workingUrl)
    setWorkingUrl(null)
    setEditorKey((value) => value + 1)
    void readImageSize(baseSourceUrl)
      .then(setImageSize)
      .catch((exception) => {
        setError(exception instanceof Error ? exception.message : 'Unable to read image size')
      })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-ink/90 p-3 backdrop-blur-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Image studio</p>
          <p className="font-serif text-2xl">Editing {asset.title ?? asset.original_filename}</p>
          <p className="mt-1 text-xs text-white/70">
            Crop uses free edges — drag any side independently, or trim left/right/top/bottom in pixels below.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
            type="button"
            onClick={resetEditor}
          >
            Return to default
          </button>
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-slate-100" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="mb-3">
        <EdgeCropControls
          size={imageSize}
          insets={insets}
          busy={edgeBusy}
          onChange={setInsets}
          onApply={() => {
            void applyEdgeCrop()
          }}
        />
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
          Crop={{
            ratio: 'custom',
            ratioTitleKey: 'custom',
            autoResize: false,
            noPresets: true,
          }}
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

/**
 * Turn a Filerobot save payload into a PNG blob.
 * @param edited - Canvas and/or base64 export from Filerobot.
 * @returns PNG blob ready for upload.
 * @throws When neither export channel is available.
 */
async function exportEditedBlob(edited: {
  imageBase64?: string
  imageCanvas?: HTMLCanvasElement
}): Promise<Blob> {
  if (edited.imageCanvas) {
    const blob = await new Promise<Blob | null>((resolve) => edited.imageCanvas?.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Image editor did not return an export')
    return blob
  }
  if (edited.imageBase64) {
    const response = await fetch(edited.imageBase64)
    return response.blob()
  }
  throw new Error('Image editor did not return an export')
}
