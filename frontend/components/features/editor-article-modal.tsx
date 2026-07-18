'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { InlineArticleTaxonomyEditor } from '@/components/features/inline-article-taxonomy-editor'
import { StoryGroupCombobox } from '@/components/features/story-group-combobox'
import { useEditorScopeContext } from '@/context/editor-scope-context'
import { DocumentTitleField } from '@/components/ui/document-title-field'
import { LocalizedFileInput } from '@/components/ui/localized-file-input'
import { RichTextEditor, type IRichTextToolbarLabels } from '@/components/ui/rich-text-editor'
import { FLORIDA_COUNTY_OPTIONS, FLORIDA_STATE_CODE } from '@/lib/florida-counties'
import type { ICategoryOut } from '@/lib/api/category-client'
import type { IStoryGroupOut } from '@/lib/api/story-group-client'
import { toRegionCode } from '@/lib/region-code'
import { PUERTO_RICO_MARKET_CODE, PUERTO_RICO_TOWN_OPTIONS } from '@/lib/puerto-rico-towns'
import { US_MARKET_CODE, US_STATE_OPTIONS } from '@/lib/us-states'
import { MAX_TITLE_LENGTH, moveItem } from '@/lib/helpers/editor-curation'
import type { IArticleDetail, ILoadedMedia } from '@/interfaces/editor-article'

interface IEditorArticleModalProps {
  isOpen: boolean
  onClose: () => void
  detail: IArticleDetail | null
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  body: string
  setBody: Dispatch<SetStateAction<string>>
  uploadImages: (files: FileList | null) => void
  uploadVideos: (files: FileList | null) => void
  uploadingMedia: boolean
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  storyId: string
  setStoryId: Dispatch<SetStateAction<string>>
  storyGroups: IStoryGroupOut[]
  maxImageCount: number
  setMaxImageCount: (value: number) => void
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  saving: boolean
  isDirty: boolean
  onSave: () => Promise<boolean>
  onPublish: () => void
  onDirty: () => void
}

/**
 * Full-screen popup that opens when a story is clicked, letting the editor edit
 * every article field in one place: headline, rich-text body, images, video,
 * taxonomy, story group, and image count, then save or publish.
 *
 * @param props Detail data, edit state, upload handlers, and save/publish callbacks.
 * @returns The popup editor overlay, or nothing when closed.
 */
export function EditorArticleModal(props: IEditorArticleModalProps): JSX.Element | null {
  const t = useTranslations('admin')
  const { isOpen, onClose, detail, isDirty, onSave } = props

  // Confirm before discarding unsaved edits when closing via Escape/overlay.
  function handleClose(): void {
    if (isDirty && !window.confirm(t('editor.guard.discard'))) {
      return
    }
    onClose()
  }

  useEscapeToClose(isOpen, handleClose)

  if (!isOpen) {
    return null
  }

  async function handleSave(): Promise<void> {
    const saved = await onSave()
    if (saved) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('editor.detail.modalHeading')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <ModalHeader status={detail?.status ?? null} onClose={handleClose} />
        {detail ? (
          <EditorArticleEditPanel {...props} onSave={() => void handleSave()} onClose={handleClose} />
        ) : (
          <p className="px-5 py-10 text-center text-sm text-neutral-500">{t('editor.loading')}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Close the modal on Escape while it is open.
 *
 * @param isOpen Whether the modal is currently visible.
 * @param onClose Close handler invoked on Escape.
 */
function useEscapeToClose(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
}

interface IModalHeaderProps {
  status: string | null
  onClose: () => void
}

/**
 * Sticky modal header with a title and close button.
 *
 * @param props Article status and the close handler.
 * @returns The modal header bar.
 */
function ModalHeader({ status, onClose }: IModalHeaderProps): JSX.Element {
  const t = useTranslations('admin')
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-lg font-bold text-neutral-900">
          {t('editor.detail.modalHeading')}
        </h2>
        {status ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
            {status}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('editor.detail.close')}
        className="rounded px-2 py-1 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
      >
        {t('editor.detail.close')}
      </button>
    </div>
  )
}

interface IEditorArticleEditPanelProps extends Omit<IEditorArticleModalProps, 'isOpen' | 'onSave'> {
  onSave: () => void
}

/**
 * Scrollable article edit form with save/publish footer for popup editors.
 *
 * @param props Edit state, upload handlers, and save/publish callbacks.
 * @returns The article edit form and action footer.
 */
export function EditorArticleEditPanel(props: IEditorArticleEditPanelProps): JSX.Element {
  const { detail, saving, onSave, onPublish, onClose } = props
  if (!detail) {
    return <></>
  }

  return (
    <>
      <ModalBody {...props} />
      <ModalFooter
        status={detail.status}
        saving={saving}
        onSave={onSave}
        onPublish={onPublish}
        onCancel={onClose}
      />
    </>
  )
}

/**
 * Scrollable modal body composing the full set of article edit controls.
 *
 * @param props The modal props forwarded from the parent.
 * @returns The article edit form contents.
 */
function ModalBody(props: IEditorArticleEditPanelProps): JSX.Element {
  const t = useTranslations('admin')
  const toolbarLabels = useToolbarLabels()
  return (
    <div className="space-y-5 px-5 py-4">
      <ScopeDefinitionEditor />

      <div>
        <span className="block text-sm font-medium text-neutral-700">
          {t('editor.detail.headline')}
        </span>
        <DocumentTitleField
          value={props.title}
          onChange={wrapValue(props.setTitle, props.onDirty)}
          placeholder={t('editor.detail.headlinePlaceholder')}
          ariaLabel={t('editor.detail.headline')}
          maxLength={MAX_TITLE_LENGTH}
          formatCount={(count, max) => t('editor.detail.titleCount', { count, max })}
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-neutral-700">
          {t('editor.detail.body')}
        </span>
        <RichTextEditor
          value={props.body}
          onChange={wrapValue(props.setBody, props.onDirty)}
          labels={toolbarLabels}
          ariaLabel={t('editor.detail.body')}
        />
      </div>

      <InlineArticleTaxonomyEditor
        categories={props.categories}
        selectedCategoryIds={props.selectedCategoryIds}
        setSelectedCategoryIds={wrapWithDirty(props.setSelectedCategoryIds, props.onDirty)}
        internationalPotential={props.internationalPotential}
        setInternationalPotential={wrapWithDirty(props.setInternationalPotential, props.onDirty)}
      />

      <div className="block text-sm font-medium text-neutral-700">
        {t('editor.detail.storyId')}
        <StoryGroupCombobox
          value={props.storyId}
          groups={props.storyGroups}
          onChange={(value) => {
            props.onDirty()
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
          value={props.maxImageCount}
          onChange={(event) => {
            props.onDirty()
            props.setMaxImageCount(Number(event.target.value))
          }}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <ModalMediaSection
        mediaItems={props.mediaItems}
        setMediaItems={wrapWithDirty(props.setMediaItems, props.onDirty)}
        uploadImages={props.uploadImages}
        uploadVideos={props.uploadVideos}
        uploadingMedia={props.uploadingMedia}
      />
    </div>
  )
}

/**
 * Scope controls shown in the selected-news modal so editors can adjust where
 * the story is being curated (market/state/county/town) without leaving edit mode.
 *
 * @returns Scope selector block and computed scope definition.
 */
function ScopeDefinitionEditor(): JSX.Element {
  const t = useTranslations('admin')
  const tNav = useTranslations('navigation')
  const { scope, setScope } = useEditorScopeContext()

  const showLocality = scope.marketCode === US_MARKET_CODE || scope.marketCode === PUERTO_RICO_MARKET_CODE
  const showCounty = scope.marketCode === US_MARKET_CODE && scope.townId === FLORIDA_STATE_CODE

  const stateLabel =
    scope.marketCode === US_MARKET_CODE && scope.townId
      ? US_STATE_OPTIONS.find((state) => state.code === scope.townId)?.label ?? scope.townId.toUpperCase()
      : null
  const townLabel =
    scope.marketCode === PUERTO_RICO_MARKET_CODE && scope.townId
      ? PUERTO_RICO_TOWN_OPTIONS.find((town) => town.code === scope.townId)?.label ?? scope.townId
      : null
  const countyLabel =
    showCounty && scope.countyId
      ? FLORIDA_COUNTY_OPTIONS.find((county) => county.code === scope.countyId)?.label ?? scope.countyId
      : null

  const definitionParts = [scope.marketCode.toUpperCase()]
  if (stateLabel) {
    definitionParts.push(stateLabel)
  }
  if (townLabel) {
    definitionParts.push(townLabel)
  }
  if (countyLabel) {
    definitionParts.push(countyLabel)
  }
  const regionCode = toRegionCode(scope.marketCode, scope.townId, scope.countyId)

  function patchScope(patch: Partial<typeof scope>): void {
    setScope({ ...scope, ...patch })
  }

  return (
    <fieldset className="rounded border border-neutral-200 bg-neutral-50 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Scope definition
      </legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-neutral-700">
          {t('editor.scope.market')}
          <select
            value={scope.marketCode}
            onChange={(event) =>
              patchScope({
                marketCode: event.target.value,
                townId: null,
                countyId: null,
              })
            }
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm capitalize"
          >
            <option value="us">US</option>
            <option value="pr">PR</option>
            <option value="co">CO</option>
          </select>
        </label>

        {showLocality ? (
          <label className="text-xs font-medium text-neutral-700">
            {scope.marketCode === US_MARKET_CODE ? tNav('state') : tNav('town')}
            <select
              value={scope.townId ?? ''}
              onChange={(event) =>
                patchScope({
                  townId: event.target.value || null,
                  countyId:
                    scope.marketCode === US_MARKET_CODE && event.target.value === FLORIDA_STATE_CODE
                      ? scope.countyId
                      : null,
                })
              }
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">
                {scope.marketCode === US_MARKET_CODE ? tNav('localityDefaultUs') : tNav('localityDefaultPr')}
              </option>
              {scope.marketCode === US_MARKET_CODE
                ? US_STATE_OPTIONS.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.label}
                    </option>
                  ))
                : PUERTO_RICO_TOWN_OPTIONS.map((town) => (
                    <option key={town.code} value={town.code}>
                      {town.label}
                    </option>
                  ))}
            </select>
          </label>
        ) : null}

        {showCounty ? (
          <label className="text-xs font-medium text-neutral-700">
            {tNav('county')}
            <select
              value={scope.countyId ?? ''}
              onChange={(event) => patchScope({ countyId: event.target.value || null })}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{tNav('county')}</option>
              {FLORIDA_COUNTY_OPTIONS.map((county) => (
                <option key={county.code} value={county.code}>
                  {county.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        Definition: <span className="font-medium text-neutral-800">{definitionParts.join(' / ')}</span>{' '}
        <span className="text-neutral-500">({regionCode})</span>
      </p>
    </fieldset>
  )
}

interface IModalFooterProps {
  status: string
  saving: boolean
  onSave: () => void
  onPublish: () => void
  onCancel: () => void
}

/**
 * Sticky modal footer with cancel, save, and conditional publish actions.
 *
 * @param props Article status, saving flag, and action handlers.
 * @returns The footer action bar.
 */
function ModalFooter({ status, saving, onSave, onPublish, onCancel }: IModalFooterProps): JSX.Element {
  const t = useTranslations('admin')
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
      >
        {t('editor.detail.close')}
      </button>
      {status === 'draft' ? (
        <button
          type="button"
          disabled={saving}
          onClick={onPublish}
          className="rounded border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
        >
          {t('editor.detail.publish')}
        </button>
      ) : null}
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {t('editor.detail.save')}
      </button>
    </div>
  )
}

interface IModalMediaSectionProps {
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  uploadImages: (files: FileList | null) => void
  uploadVideos: (files: FileList | null) => void
  uploadingMedia: boolean
}

/**
 * Unified media gallery: add images and videos, reorder, and remove any item.
 *
 * Images and videos share one ordered list so editors can attach multiple of
 * each and arrange their order; the order is persisted to the article's media.
 *
 * @param props Media list, its setter, upload handlers, and upload state.
 * @returns The media management section.
 */
function ModalMediaSection({
  mediaItems,
  setMediaItems,
  uploadImages,
  uploadVideos,
  uploadingMedia,
}: IModalMediaSectionProps): JSX.Element {
  const t = useTranslations('admin')
  return (
    <div>
      <p className="text-sm font-medium text-neutral-700">
        {t('editor.detail.media')} ({mediaItems.length})
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <LocalizedFileInput
          accept="image/*"
          multiple
          disabled={uploadingMedia}
          onSelect={uploadImages}
          buttonLabel={t('editor.detail.addImages')}
          emptyLabel={t('editor.detail.noFileSelected')}
          formatSelected={(count) => t('editor.detail.filesSelected', { count })}
        />
        <LocalizedFileInput
          accept="video/*"
          multiple
          disabled={uploadingMedia}
          onSelect={uploadVideos}
          buttonLabel={t('editor.detail.addVideos')}
          emptyLabel={t('editor.detail.noFileSelected')}
          formatSelected={(count) => t('editor.detail.filesSelected', { count })}
        />
      </div>
      {uploadingMedia ? (
        <p className="mt-2 text-sm text-neutral-500" aria-live="polite">
          {t('editor.detail.uploading')}
        </p>
      ) : null}
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mediaItems.map((item, index) => (
          <li
            key={item.id || `${item.fileType}-${item.url}`}
            className="overflow-hidden rounded border border-neutral-200"
          >
            <MediaPreview item={item} index={index} />
            <div className="flex items-center gap-2 border-t border-neutral-200 px-2 py-1.5">
              <span className="flex-1 text-xs font-medium text-neutral-500">
                #{index + 1} Â· {t(`editor.detail.type.${item.fileType}`)}
              </span>
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
              <button
                type="button"
                onClick={() => setMediaItems((current) => current.filter((_, i) => i !== index))}
                className="text-xs text-red-600 hover:underline"
              >
                {t('editor.detail.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {mediaItems.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{t('editor.detail.noMedia')}</p>
      ) : null}
    </div>
  )
}

interface IMediaPreviewProps {
  item: ILoadedMedia
  index: number
}

/**
 * Render a single gallery item as a video player or an image preview.
 *
 * @param props The media item and its position in the gallery.
 * @returns The media preview element.
 */
function MediaPreview({ item, index }: IMediaPreviewProps): JSX.Element {
  const t = useTranslations('admin')
  if (item.fileType === 'video') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={`${item.url}#t=0.1`}
        controls
        preload="metadata"
        className="aspect-[4/3] w-full bg-black object-contain"
      />
    )
  }
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={t('editor.detail.imagePosition', { position: index + 1 })}
        className="aspect-[4/3] w-full object-cover"
      />
    </a>
  )
}

/**
 * Build the localized rich-text toolbar labels from the reporter namespace.
 *
 * @returns Memoized toolbar labels for the body editor.
 */
function useToolbarLabels(): IRichTextToolbarLabels {
  const t = useTranslations('admin')
  return useMemo<IRichTextToolbarLabels>(
    () => ({
      bold: t('reporter.editor.bold'),
      italic: t('reporter.editor.italic'),
      heading2: t('reporter.editor.heading2'),
      heading3: t('reporter.editor.heading3'),
      bulletList: t('reporter.editor.bulletList'),
      orderedList: t('reporter.editor.orderedList'),
      blockquote: t('reporter.editor.blockquote'),
      link: t('reporter.editor.link'),
      unlink: t('reporter.editor.unlink'),
      linkPrompt: t('reporter.editor.linkPrompt'),
      undo: t('reporter.editor.undo'),
      redo: t('reporter.editor.redo'),
    }),
    [t],
  )
}

/**
 * Wrap a value-callback so any change first flags the form as dirty.
 *
 * @param onChange Original value handler.
 * @param onDirty Callback marking the form dirty.
 * @returns A handler that records the edit before delegating.
 */
function wrapValue<T>(onChange: (value: T) => void, onDirty: () => void): (value: T) => void {
  return (value) => {
    onDirty()
    onChange(value)
  }
}

/**
 * Wrap a state setter so any change first flags the form as dirty.
 *
 * @param setter Original React state dispatcher.
 * @param onDirty Callback marking the form dirty.
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
