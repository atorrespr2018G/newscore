'use client'

import { useEffect, useState } from 'react'
import { IMediaAsset, listAssetVersions } from '@/lib/media-editor-client'

interface IVersionPickerProps {
  asset: IMediaAsset
  onClose: () => void
  onChoose: (asset: IMediaAsset) => void
  onDelete: (asset: IMediaAsset) => Promise<void>
  onError: (message: string) => void
}

/**
 * Re-edit modal: select a version, then edit or delete that selection.
 * @param props - Picture family seed asset and edit/delete callbacks.
 * @returns Modal listing versions with edit/delete actions for the selection.
 */
export function VersionPicker({
  asset,
  onClose,
  onChoose,
  onDelete,
  onError,
}: IVersionPickerProps): JSX.Element {
  const [items, setItems] = useState<IMediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void listAssetVersions(asset.id)
      .then((response) => {
        if (!active) return
        setItems(response.items)
        const preferred =
          response.items.find((item) => item.id === asset.id)
          ?? response.items[response.items.length - 1]
          ?? null
        setSelectedId(preferred?.id ?? null)
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

  const selected = items.find((item) => item.id === selectedId) ?? null
  const isOriginal = Boolean(selected && !selected.version_of)
  const canDeleteSelected = Boolean(selected && selected.version_of)

  async function handleDelete(): Promise<void> {
    if (!selected?.version_of) {
      onError('Re-edit cannot delete the original. Use Delete original in the originals pool.')
      return
    }
    const label = selected.title ?? selected.original_filename
    if (!window.confirm(`Delete this edit of "${label}"? The original stays in the story.`)) {
      return
    }
    setDeleting(true)
    try {
      await onDelete(selected)
      const remaining = items.filter((item) => item.id !== selected.id)
      setItems(remaining)
      setSelectedId(remaining.find((item) => item.version_of)?.id ?? remaining[0]?.id ?? null)
      if (remaining.length <= 1) onClose()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to delete picture version')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/80 p-4 backdrop-blur-sm">
      <div className="me-panel w-full max-w-2xl overflow-hidden">
        <div className="border-b border-brand-line px-6 py-5">
          <p className="me-label mb-0">Re-edit</p>
          <h2 className="font-serif text-3xl text-brand-ink">Choose a version</h2>
          <p className="mt-2 text-sm text-slate-500">
            Select a version, then Edit. Delete is only for edits — never the original.
          </p>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading versions…</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item, index) => {
                const itemIsOriginal = !item.version_of
                const active = item.id === selectedId
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`w-full overflow-hidden rounded-2xl border bg-white text-left transition ${
                        active
                          ? 'border-brand shadow-panel ring-2 ring-brand/20'
                          : 'border-brand-line hover:border-brand'
                      }`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="relative aspect-[4/3] bg-brand-mist">
                        <img
                          alt={item.alt_text ?? item.original_filename}
                          className="h-full w-full object-cover"
                          src={item.preview_url ?? item.url}
                        />
                        <span className="absolute left-3 top-3 rounded-lg bg-brand-ink/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                          {itemIsOriginal ? 'Original' : `Edit ${index}`}
                        </span>
                      </div>
                      <div className="px-3 py-3">
                        <p className="truncate text-sm font-semibold text-brand-ink">
                          {item.title ?? item.original_filename}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                          {active ? ' · selected' : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-line px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500">
              {selected
                ? `Selected: ${selected.title ?? selected.original_filename}`
                : 'Select a picture above'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="me-btn-secondary" onClick={onClose} disabled={deleting}>
              Cancel
            </button>
            {canDeleteSelected && (
              <button
                type="button"
                className="me-btn-danger"
                disabled={deleting}
                onClick={() => {
                  void handleDelete()
                }}
              >
                {deleting ? 'Deleting…' : 'Delete edit'}
              </button>
            )}
            {isOriginal && (
              <p className="text-xs text-slate-500 self-center">
                Original cannot be deleted here
              </p>
            )}
            <button
              type="button"
              className="me-btn-primary"
              disabled={!selected || deleting}
              onClick={() => selected && onChoose(selected)}
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
