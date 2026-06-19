'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useEditorScope } from '@/context/editor-scope-context'
import { apiConfig } from '@/lib/api/config'
import { getHomepageLayout } from '@/lib/api/layout-client'
import { IMediaOut, uploadImage, uploadVideo } from '@/lib/api/media-client'
import { apiFetch } from '@/lib/api/rest-client'

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
  const scope = useEditorScope()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState<IUploadedImage[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [marketId, setMarketId] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  useEffect(() => {
    void getHomepageLayout(scope.marketCode, scope.pageName)
      .then((layout) => setMarketId(layout.market_id))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to resolve market')
      })
  }, [scope.marketCode, scope.pageName])

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
      setError(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      setUploadingMedia(false)
    }
  }, [])

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
      setError(err instanceof Error ? err.message : 'Video upload failed')
    } finally {
      setUploadingMedia(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!marketId) {
      setError('Market is not ready yet. Try again in a moment.')
      return
    }
    if (uploadingMedia) {
      setError('Wait for uploads to finish before saving.')
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
          market_ids: [marketId],
          media_ids: images.map((image) => image.id),
          thumbnail_url: images[0]?.url ?? null,
          video_url: videoUrl,
        }),
      })
      setSuccess(`Draft saved: ${article.title}`)
      setTitle('')
      setBody('')
      setImages([])
      setVideoUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Reporter</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Upload news title, body, images, and video.
      </p>

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

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
        <label className="block text-sm font-medium text-neutral-700">
          Headline
          <input
            required
            minLength={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-neutral-700">
          Body
          <textarea
            required
            minLength={10}
            rows={8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <div>
          <p className="text-sm font-medium text-neutral-700">Images</p>
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
                    <p className="truncate text-xs text-neutral-500">Position {index + 1}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setImages((current) => current.filter((item) => item.id !== image.id))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Drag rows to reorder after upload.</p>
          )}
        </div>

        <label className="block text-sm font-medium text-neutral-700">
          Optional video
          <input
            type="file"
            accept="video/*"
            disabled={uploadingMedia}
            onChange={(event) => void handleVideoUpload(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          {videoUrl ? <p className="mt-1 text-xs text-neutral-500">Video attached.</p> : null}
        </label>

        <button
          type="submit"
          disabled={loading || uploadingMedia}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save draft'}
        </button>
      </form>
    </div>
  )
}
