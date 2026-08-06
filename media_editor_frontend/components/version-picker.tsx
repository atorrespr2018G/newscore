'use client'

import { useEffect, useState } from 'react'
import { IMediaAsset, listAssetVersions } from '@/lib/media-editor-client'

interface IVersionPickerProps {
  asset: IMediaAsset
  onClose: () => void
  onChoose: (asset: IMediaAsset) => void
  onError: (message: string) => void
}

/**
 * Popup that lets a reporter pick which saved version to open in the image editor.
 * @param props - Picture family seed asset and selection callbacks.
 * @returns Modal listing the original and every edited version.
 */
export function VersionPicker({ asset, onClose, onChoose, onError }: IVersionPickerProps): JSX.Element {
  const [items, setItems] = useState<IMediaAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    void listAssetVersions(asset.id)
      .then((response) => {
        if (!active) return
        setItems(response.items)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        onError(error instanceof Error ? error.message : 'Unable to load picture versions')
        onClose()
      })
    return () => {
      active = false
    }
    // Intentionally keyed only by asset id so parent callback identity does not reload the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/80 p-4 backdrop-blur-sm">
      <div className="me-panel w-full max-w-2xl overflow-hidden">
        <div className="border-b border-brand-line px-6 py-5">
          <p className="me-label mb-0">Re-edit</p>
          <h2 className="font-serif text-3xl text-brand-ink">Choose a version</h2>
          <p className="mt-2 text-sm text-slate-500">
            Pick the original or a previous edit to open in the picture editor.
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading versions…</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item, index) => {
                const isOriginal = !item.version_of
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full overflow-hidden rounded-2xl border border-brand-line bg-white text-left transition hover:border-brand hover:shadow-panel"
                      onClick={() => onChoose(item)}
                    >
                      <div className="relative aspect-[4/3] bg-brand-mist">
                        <img
                          alt={item.alt_text ?? item.original_filename}
                          className="h-full w-full object-cover"
                          src={item.preview_url ?? item.url}
                        />
                        <span className="absolute left-3 top-3 rounded-lg bg-brand-ink/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                          {isOriginal ? 'Original' : `Edit ${index}`}
                        </span>
                      </div>
                      <div className="px-3 py-3">
                        <p className="truncate text-sm font-semibold text-brand-ink">
                          {item.title ?? item.original_filename}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-brand-line px-6 py-4">
          <button type="button" className="me-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
