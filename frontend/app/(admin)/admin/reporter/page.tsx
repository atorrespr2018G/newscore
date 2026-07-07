'use client'

import { useTranslations } from 'next-intl'
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { DocumentTitleField } from '@/components/ui/document-title-field'
import { LocalizedFileInput } from '@/components/ui/localized-file-input'
import { RichTextEditor, type IRichTextToolbarLabels } from '@/components/ui/rich-text-editor'
import { useEditorScope } from '@/context/editor-scope-context'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { submitArticleForReview } from '@/lib/api/article-workflow-client'
import { getCategories, type ICategoryOut } from '@/lib/api/category-client'
import { apiConfig } from '@/lib/api/config'
import { getHomepageLayout } from '@/lib/api/layout-client'
import { IMediaOut, uploadImage, uploadVideo } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'
import { toRegionCode } from '@/lib/region-code'
import {
  INTERNATIONAL_POTENTIAL_OPTIONS,
  MAX_CATEGORY_COUNT,
  MIN_CATEGORY_COUNT,
  toggleCategory,
} from '@/lib/helpers/category-selection'

const MAX_TITLE_LENGTH = 200
const MIN_BODY_TEXT_LENGTH = 10

interface IUploadedMedia {
  id: string
  url: string
}

interface IArticleOut {
  id: string
  title: string
  slug: string
  status: string
}

/**
 * Move an array item to a new index for drag-and-drop reordering.
 *
 * @param items Source list.
 * @param fromIndex Current index.
 * @param toIndex Target index.
 * @returns Reordered list.
 */
function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

/**
 * Extract trimmed plain text length from an HTML string for length validation.
 *
 * @param html Rich-text editor HTML output.
 * @returns Number of non-whitespace-trimmed text characters in the document.
 */
function htmlTextLength(html: string): number {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, '').trim().length
  }
  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent ?? '').trim().length
}

export default function ReporterUploadPage(): JSX.Element {
  const t = useTranslations('admin')
  const { categoryLabel } = useSectionLabels()
  const scope = useEditorScope()
  const toolbarLabels = useMemo<IRichTextToolbarLabels>(
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
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState<IUploadedMedia[]>([])
  const [videos, setVideos] = useState<IUploadedMedia[]>([])
  const [marketId, setMarketId] = useState<string | null>(null)
  const [categories, setCategories] = useState<ICategoryOut[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [internationalPotential, setInternationalPotential] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [videoDragIndex, setVideoDragIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [savedArticle, setSavedArticle] = useState<IArticleOut | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const regionCode = toRegionCode(scope.marketCode, scope.townId ?? null, scope.countyId ?? null)
    void getHomepageLayout(scope.marketCode, scope.pageName, regionCode)
      .then((layout) => setMarketId(layout.market_id))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('reporter.errors.resolveMarket'))
      })
  }, [scope.countyId, scope.marketCode, scope.pageName, scope.townId, t])

  useEffect(() => {
    void getCategories()
      .then((items) => setCategories(items))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('reporter.errors.loadCategories'))
      })
  }, [t])

  /**
   * Upload every selected file through `upload` and append the results to a
   * media list, surfacing a localized error on failure.
   *
   * @param options Selected files, the per-file uploader, the target list
   *   setter, and the translation key used for upload failures.
   */
  const uploadFilesInto = useCallback(
    async (options: {
      files: FileList | null
      upload: (file: File) => Promise<IMediaOut>
      setList: Dispatch<SetStateAction<IUploadedMedia[]>>
      errorKey: string
    }): Promise<void> => {
      const { files, upload, setList, errorKey } = options
      if (!files?.length) {
        return
      }
      setUploadingMedia(true)
      setError(null)
      try {
        const uploaded: IUploadedMedia[] = []
        for (const file of Array.from(files)) {
          const media: IMediaOut = await upload(file)
          uploaded.push({ id: media.id, url: media.url })
        }
        setList((current) => [...current, ...uploaded])
      } catch (err) {
        setError(err instanceof Error ? err.message : t(errorKey))
      } finally {
        setUploadingMedia(false)
      }
    },
    [t],
  )

  const handleImageUpload = useCallback(
    (files: FileList | null) =>
      uploadFilesInto({
        files,
        upload: uploadImage,
        setList: setImages,
        errorKey: 'reporter.errors.imageUpload',
      }),
    [uploadFilesInto],
  )

  const handleVideoUpload = useCallback(
    (files: FileList | null) =>
      uploadFilesInto({
        files,
        upload: uploadVideo,
        setList: setVideos,
        errorKey: 'reporter.errors.videoUpload',
      }),
    [uploadFilesInto],
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!marketId) {
      setError(t('reporter.validation.marketNotReady'))
      return
    }
    if (uploadingMedia) {
      setError(t('reporter.validation.waitForUploads'))
      return
    }
    if (selectedCategoryIds.length < MIN_CATEGORY_COUNT) {
      setError(t('reporter.validation.selectCategory'))
      return
    }
    if (title.trim().length < 3) {
      setError(t('reporter.validation.titleTooShort'))
      return
    }
    if (htmlTextLength(body) < MIN_BODY_TEXT_LENGTH) {
      setError(t('reporter.validation.bodyTooShort'))
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const article = await apiFetch<IArticleOut>(`${apiConfig.news}/articles`, {
        method: 'POST',
        body: JSON.stringify({
          direct_region_ids: [toRegionCode(scope.marketCode, scope.townId ?? null, scope.countyId ?? null)],
          region_visibility_mode: 'upward_only',
          title,
          body,
          category_ids: selectedCategoryIds,
          international_potential: internationalPotential,
          market_ids: [marketId],
          // Videos ride along in media_ids (uncapped on the backend) so a story
          // can carry several clips; the first video also fills video_url as the
          // lead/teaser clip for hero and card views.
          media_ids: [...images.map((image) => image.id), ...videos.map((video) => video.id)],
          thumbnail_url: images[0]?.url ?? null,
          video_url: videos[0]?.url ?? null,
        }),
      })
      setSuccess(t('reporter.status.draftSaved', { title: article.title }))
      setSavedArticle(article)
      setTitle('')
      setBody('')
      setImages([])
      setVideos([])
      setSelectedCategoryIds([])
      setInternationalPotential(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reporter.errors.saveDraft'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitForReview = useCallback(async () => {
    if (!savedArticle) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitArticleForReview(savedArticle.id)
      setSuccess(t('reporter.status.submittedForReview', { title: savedArticle.title }))
      setSavedArticle(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reporter.errors.submitForReview'))
    } finally {
      setSubmitting(false)
    }
  }, [savedArticle, t])

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('reporter.title')}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t('reporter.subtitle')}</p>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
          {success}
        </p>
      ) : null}
      {savedArticle ? (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmitForReview()}
          className="mt-3 rounded border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
        >
          {submitting ? t('reporter.actions.submitting') : t('reporter.actions.submitForReview')}
        </button>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
        <div>
          <span className="block text-sm font-medium text-neutral-700">
            {t('reporter.fields.headline')}
          </span>
          <DocumentTitleField
            value={title}
            onChange={setTitle}
            placeholder={t('reporter.fields.headlinePlaceholder')}
            ariaLabel={t('reporter.fields.headline')}
            maxLength={MAX_TITLE_LENGTH}
            formatCount={(count, max) => t('reporter.fields.titleCount', { count, max })}
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-neutral-700">
            {t('reporter.fields.body')}
          </span>
          <RichTextEditor
            value={body}
            onChange={setBody}
            labels={toolbarLabels}
            ariaLabel={t('reporter.fields.body')}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-700">
            {t('reporter.fields.categories')}{' '}
            <span className="font-normal text-neutral-500">
              {t('reporter.fields.categoriesHint')}
            </span>
          </legend>
          <p className="mt-1 text-xs text-neutral-500">
            {t('reporter.fields.selectedCount', {
              count: selectedCategoryIds.length,
              max: MAX_CATEGORY_COUNT,
            })}
            {selectedCategoryIds.length >= MAX_CATEGORY_COUNT ? (
              <span className="ml-1 text-neutral-400">{t('reporter.fields.uncheckHint')}</span>
            ) : null}
          </p>
          {categories.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categories.map((category) => {
                const checked = selectedCategoryIds.includes(category.id)
                const disabled =
                  !checked && selectedCategoryIds.length >= MAX_CATEGORY_COUNT
                return (
                  <label
                    key={category.id}
                    className={`flex items-center gap-1.5 rounded border border-neutral-200 px-2 py-1 text-xs ${
                      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() =>
                        setSelectedCategoryIds((current) => toggleCategory(current, category.id))
                      }
                    />
                    <span>{categoryLabel(category.slug, category.name)}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">
              {t('reporter.fields.loadingCategories')}
            </p>
          )}
        </fieldset>

        <label className="block text-sm font-medium text-neutral-700">
          {t('reporter.fields.internationalPotential')}
          <span className="font-normal text-neutral-500">
            {' '}
            {t('reporter.fields.internationalPotentialHint')}
          </span>
          <select
            value={internationalPotential ?? ''}
            onChange={(event) =>
              setInternationalPotential(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
            className="mt-1 block w-32 rounded border border-neutral-300 px-3 py-2"
          >
            <option value="">{t('reporter.fields.notRated')}</option>
            {INTERNATIONAL_POTENTIAL_OPTIONS.map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-sm font-medium text-neutral-700">{t('reporter.fields.images')}</p>
          <LocalizedFileInput
            accept="image/*"
            multiple
            disabled={uploadingMedia}
            onSelect={(files) => void handleImageUpload(files)}
            buttonLabel={t('reporter.fields.chooseFiles')}
            emptyLabel={t('reporter.fields.noFileSelected')}
            formatSelected={(count) => t('reporter.fields.filesSelected', { count })}
          />
          {images.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === index) {
                      return
                    }
                    setImages((current) => moveItem(current, dragIndex, index))
                    setDragIndex(null)
                  }}
                  className="flex items-center gap-3 rounded border border-neutral-200 bg-white p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="h-16 w-16 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-neutral-500">
                      {t('reporter.fields.position', { position: index + 1 })}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setImages((current) => current.filter((item) => item.id !== image.id))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('reporter.fields.remove')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">{t('reporter.fields.imagesEmpty')}</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-700">{t('reporter.fields.videos')}</p>
          <LocalizedFileInput
            accept="video/*"
            multiple
            disabled={uploadingMedia}
            onSelect={(files) => void handleVideoUpload(files)}
            buttonLabel={t('reporter.fields.chooseFiles')}
            emptyLabel={t('reporter.fields.noFileSelected')}
            formatSelected={(count) => t('reporter.fields.filesSelected', { count })}
          />
          {videos.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {videos.map((video, index) => (
                <li
                  key={video.id}
                  draggable
                  onDragStart={() => setVideoDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (videoDragIndex === null || videoDragIndex === index) {
                      return
                    }
                    setVideos((current) => moveItem(current, videoDragIndex, index))
                    setVideoDragIndex(null)
                  }}
                  className="flex items-center gap-3 rounded border border-neutral-200 bg-white p-2"
                >
                  <video
                    src={`${video.url}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-16 w-16 rounded bg-black object-cover"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-neutral-500">
                      {t('reporter.fields.videoPosition', { position: index + 1 })}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setVideos((current) => current.filter((item) => item.id !== video.id))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('reporter.fields.remove')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">{t('reporter.fields.videosEmpty')}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || uploadingMedia || selectedCategoryIds.length < MIN_CATEGORY_COUNT}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {loading ? t('reporter.actions.saving') : t('reporter.actions.save')}
        </button>
      </form>
    </div>
  )
}
