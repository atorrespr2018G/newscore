'use client'

import { useTranslations } from 'next-intl'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useEditorScope } from '@/context/editor-scope-context'
import { submitArticleForReview } from '@/lib/api/article-workflow-client'
import { getCategories, type ICategoryOut } from '@/lib/api/category-client'
import { apiConfig } from '@/lib/api/config'
import { getHomepageLayout } from '@/lib/api/layout-client'
import { IMediaOut, uploadImage, uploadVideo } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'
import {
  INTERNATIONAL_POTENTIAL_OPTIONS,
  MAX_CATEGORY_COUNT,
  MIN_CATEGORY_COUNT,
  toggleCategory,
} from '@/lib/helpers/category-selection'

interface IUploadedImage {
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

export default function ReporterUploadPage(): JSX.Element {
  const t = useTranslations('admin')
  const scope = useEditorScope()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState<IUploadedImage[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [marketId, setMarketId] = useState<string | null>(null)
  const [categories, setCategories] = useState<ICategoryOut[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [internationalPotential, setInternationalPotential] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [savedArticle, setSavedArticle] = useState<IArticleOut | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void getHomepageLayout(scope.marketCode, scope.pageName)
      .then((layout) => setMarketId(layout.market_id))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('reporter.errors.resolveMarket'))
      })
  }, [scope.marketCode, scope.pageName, t])

  useEffect(() => {
    void getCategories()
      .then((items) => setCategories(items))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('reporter.errors.loadCategories'))
      })
  }, [t])

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) {
      return
    }
    setUploadingMedia(true)
    setError(null)
    try {
      const uploaded: IUploadedImage[] = []
      for (const file of Array.from(files)) {
        const media: IMediaOut = await uploadImage(file)
        uploaded.push({ id: media.id, url: media.url })
      }
      setImages((current) => [...current, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reporter.errors.imageUpload'))
    } finally {
      setUploadingMedia(false)
    }
  }, [t])

  async function handleVideoUpload(file: File | null) {
    if (!file) {
      return
    }
    setUploadingMedia(true)
    setError(null)
    try {
      const media = await uploadVideo(file)
      setVideoUrl(media.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reporter.errors.videoUpload'))
    } finally {
      setUploadingMedia(false)
    }
  }

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

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const article = await apiFetch<IArticleOut>(`${apiConfig.news}/articles`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          category_ids: selectedCategoryIds,
          international_potential: internationalPotential,
          market_ids: [marketId],
          media_ids: images.map((image) => image.id),
          thumbnail_url: images[0]?.url ?? null,
          video_url: videoUrl,
        }),
      })
      setSuccess(t('reporter.status.draftSaved', { title: article.title }))
      setSavedArticle(article)
      setTitle('')
      setBody('')
      setImages([])
      setVideoUrl(null)
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
        <label className="block text-sm font-medium text-neutral-700">
          {t('reporter.fields.headline')}
          <input
            required
            minLength={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-neutral-700">
          {t('reporter.fields.body')}
          <textarea
            required
            minLength={10}
            rows={8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>

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
                    <span>{category.name}</span>
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
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploadingMedia}
            onChange={(event) => void handleImageUpload(event.target.files)}
            className="mt-2 block w-full text-sm"
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

        <label className="block text-sm font-medium text-neutral-700">
          {t('reporter.fields.video')}
          <input
            type="file"
            accept="video/*"
            disabled={uploadingMedia}
            onChange={(event) => void handleVideoUpload(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          {videoUrl ? (
            <p className="mt-1 text-xs text-neutral-500">{t('reporter.fields.videoAttached')}</p>
          ) : null}
        </label>

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
