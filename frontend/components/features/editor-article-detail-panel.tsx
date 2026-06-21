'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  formatAllArticlePlacements,
  type IArticlePlacement,
} from '@/lib/helpers/article-placements'
import { moveItem } from '@/lib/helpers/editor-curation'
import type { IArticleDetail, ILoadedMedia } from '@/hooks/use-editor-curation'

interface IEditorArticleDetailPanelProps {
  detail: IArticleDetail | null
  placements: IArticlePlacement[]
  maxImageCount: number
  onMaxImageCountChange: (value: number) => void
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  saving: boolean
  onSave: () => void
  onPublish: () => void
}

/**
 * Editor side panel for curating a selected article's media order and publish state.
 *
 * @param props Detail data, media list, and save/publish callbacks.
 * @returns The article curation panel, or a placeholder when nothing is selected.
 */
export function EditorArticleDetailPanel({
  detail,
  placements,
  maxImageCount,
  onMaxImageCountChange,
  mediaItems,
  setMediaItems,
  saving,
  onSave,
  onPublish,
}: IEditorArticleDetailPanelProps): JSX.Element {
  if (!detail) {
    return (
      <p className="text-sm text-neutral-500">Select a story to curate media and placement.</p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-lg font-semibold">{detail.title}</h2>
        <p className="mt-1 font-mono text-xs text-neutral-400">{detail.id}</p>
        <p className="text-xs uppercase tracking-wide text-neutral-500">{detail.status}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Location: {formatAllArticlePlacements(placements)}
        </p>
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        Max image count
        <input
          type="number"
          min={1}
          max={20}
          value={maxImageCount}
          onChange={(event) => onMaxImageCountChange(Number(event.target.value))}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <EditorMediaList mediaItems={mediaItems} setMediaItems={setMediaItems} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
        >
          Save changes
        </button>
        {detail.status === 'draft' ? (
          <button
            type="button"
            disabled={saving}
            onClick={onPublish}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
          >
            Publish
          </button>
        ) : null}
      </div>
    </div>
  )
}

interface IEditorMediaListProps {
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
}

/**
 * Ordered list of attached images with up/down reordering controls.
 *
 * @param props Media items and their setter.
 * @returns The reorderable media list.
 */
function EditorMediaList({ mediaItems, setMediaItems }: IEditorMediaListProps): JSX.Element {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-700">Attached images</p>
      <ul className="mt-2 space-y-2">
        {mediaItems.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded border border-neutral-200 p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" className="h-12 w-12 rounded object-cover" />
            <span className="flex-1 text-xs text-neutral-500">#{index + 1}</span>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setMediaItems((current) => moveItem(current, index, index - 1))}
              className="text-xs text-neutral-600 hover:text-brand disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              disabled={index === mediaItems.length - 1}
              onClick={() => setMediaItems((current) => moveItem(current, index, index + 1))}
              className="text-xs text-neutral-600 hover:text-brand disabled:opacity-40"
            >
              Down
            </button>
          </li>
        ))}
      </ul>
      {mediaItems.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No images attached.</p>
      ) : null}
    </div>
  )
}
