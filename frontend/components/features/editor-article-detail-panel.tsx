'use client'

import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import { InlineArticleTaxonomyEditor } from '@/components/features/inline-article-taxonomy-editor'
import { StoryGroupCombobox } from '@/components/features/story-group-combobox'
import type { ICategoryOut } from '@/lib/api/category-client'
import type { IStoryGroupOut } from '@/lib/api/story-group-client'
import { moveItem } from '@/lib/helpers/editor-curation'
import type { IArticleDetail, ILoadedMedia } from '@/hooks/use-editor-curation'

interface IEditorArticleDetailPanelProps {
  detail: IArticleDetail | null
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  storyId: string
  setStoryId: Dispatch<SetStateAction<string>>
  storyGroups: IStoryGroupOut[]
  maxImageCount: number
  onMaxImageCountChange: (value: number) => void
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  saving: boolean
  onSave: () => void
  onPublish: () => void
  onDirty: () => void
}

/**
 * Inline editor revealed under the selected story card for curating its
 * taxonomy, image order, and publish state in one place.
 *
 * Rendering this beside the selected card keeps the story's pictures right
 * next to the selection instead of detached at the bottom of the workspace.
 *
 * @param props Detail data, taxonomy state, media list, and save/publish callbacks.
 * @returns The selected-article curation panel, or nothing when no detail is loaded.
 */
export function EditorArticleDetailPanel(props: IEditorArticleDetailPanelProps): JSX.Element | null {
  const t = useTranslations('admin')
  const { detail, maxImageCount, onMaxImageCountChange, mediaItems, setMediaItems, saving, onSave, onPublish, onDirty } =
    props

  if (!detail) {
    return null
  }

  return (
    <div className="space-y-4 border-t border-neutral-100 bg-neutral-50 p-3">
      <InlineArticleTaxonomyEditor
        categories={props.categories}
        selectedCategoryIds={props.selectedCategoryIds}
        setSelectedCategoryIds={wrapWithDirty(props.setSelectedCategoryIds, onDirty)}
        internationalPotential={props.internationalPotential}
        setInternationalPotential={wrapWithDirty(props.setInternationalPotential, onDirty)}
      />

      <div className="block text-sm font-medium text-neutral-700">
        {t('editor.detail.storyId')}
        <StoryGroupCombobox
          value={props.storyId}
          groups={props.storyGroups}
          onChange={(value) => {
            onDirty()
            props.setStoryId(value)
          }}
        />
        <span className="mt-1 block text-xs font-normal text-neutral-500">
          {t('editor.detail.storyIdHint')}
        </span>
      </div>

      <label className="block text-sm font-medium text-neutral-700">
        {t('editor.detail.maxImageCount')}
        <input
          type="number"
          min={1}
          max={20}
          value={maxImageCount}
          onChange={(event) => {
            onDirty()
            onMaxImageCountChange(Number(event.target.value))
          }}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <EditorMediaList mediaItems={mediaItems} setMediaItems={wrapWithDirty(setMediaItems, onDirty)} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {t('editor.detail.save')}
        </button>
        {detail.status === 'draft' ? (
          <button
            type="button"
            disabled={saving}
            onClick={onPublish}
            className="rounded border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
          >
            {t('editor.detail.publish')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Wrap a state setter so any change first flags the detail panel as dirty.
 *
 * @param setter Original React state dispatcher.
 * @param onDirty Callback marking the panel dirty.
 * @returns A dispatcher that records the edit before delegating.
 */
function wrapWithDirty<T>(
  setter: Dispatch<SetStateAction<T>>,
  onDirty: () => void,
): Dispatch<SetStateAction<T>> {
  return (value) => {
    onDirty()
    setter(value)
  }
}

interface IEditorMediaListProps {
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
}

/**
 * Ordered grid of attached images with large previews and reordering controls.
 *
 * Previews are rendered large enough to actually review each picture, and each
 * one links to the full-size asset so editors can confirm every uploaded image
 * for the story rather than a single tiny thumbnail.
 *
 * @param props Media items and their setter.
 * @returns The reorderable media gallery.
 */
function EditorMediaList({ mediaItems, setMediaItems }: IEditorMediaListProps): JSX.Element {
  const t = useTranslations('admin')
  return (
    <div>
      <p className="text-sm font-medium text-neutral-700">
        {t('editor.detail.attachedImages')} ({mediaItems.length})
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mediaItems.map((item, index) => (
          <li key={item.id} className="overflow-hidden rounded border border-neutral-200">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={t('editor.detail.imagePosition', { position: index + 1 })}
                className="aspect-[4/3] w-full object-cover"
              />
            </a>
            <div className="flex items-center gap-2 border-t border-neutral-200 px-2 py-1.5">
              <span className="flex-1 text-xs font-medium text-neutral-500">#{index + 1}</span>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setMediaItems((current) => moveItem(current, index, index - 1))}
                className="text-xs text-neutral-600 hover:text-brand disabled:opacity-40"
              >
                {t('editor.detail.up')}
              </button>
              <button
                type="button"
                disabled={index === mediaItems.length - 1}
                onClick={() => setMediaItems((current) => moveItem(current, index, index + 1))}
                className="text-xs text-neutral-600 hover:text-brand disabled:opacity-40"
              >
                {t('editor.detail.down')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {mediaItems.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{t('editor.detail.noImages')}</p>
      ) : null}
    </div>
  )
}
