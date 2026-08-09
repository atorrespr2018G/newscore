'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listMediaDeskHandoffs,
  type IMediaDeskAsset,
  type IMediaDeskHandoffPackage,
} from '@/lib/api/media-editor-handoff-client'
import { registerExternalMedia, type IMediaOut } from '@/lib/api/media-client'
import { mediaDeskVersionLabel } from '@/lib/helpers/media-desk-version-label'

/** News Storage media row attached to the reporter draft. */
export interface IReporterDraftMedia {
  id: string
  url: string
  sourceAssetId?: string
}

interface IMediaDeskImportProps {
  images: IReporterDraftMedia[]
  videos: IReporterDraftMedia[]
  onImportImages: (items: IReporterDraftMedia[]) => void
  onImportVideos: (items: IReporterDraftMedia[]) => void
  onError: (message: string) => void
  disabled?: boolean
}

/**
 * Resolve a Media Desk asset URL to an absolute http(s) URL for News Storage.
 *
 * @param url Asset URL from the handoff package.
 * @returns Absolute URL when the value was site-relative.
 */
function toAbsoluteAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  const origin = (process.env.NEXT_PUBLIC_MEDIA_EDITOR_API_URL ?? 'http://localhost:5004')
    .replace(/\/api\/v1\/media-editor\/?$/, '')
    .replace(/\/$/, '')
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * Whether the asset can be registered into News Storage article media.
 *
 * @param asset Media Desk asset.
 * @returns True for image and video only.
 */
function isImportableAsset(asset: IMediaDeskAsset): boolean {
  return asset.file_type === 'image' || asset.file_type === 'video'
}

/**
 * Map a Media Desk asset into a News Storage registration payload.
 *
 * @param asset Importable image or video asset.
 * @returns External registration body.
 */
function toRegisterPayload(asset: IMediaDeskAsset) {
  return {
    file_type: asset.file_type as 'image' | 'video',
    url: toAbsoluteAssetUrl(asset.url),
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
    source_asset_id: asset.id,
  }
}

/**
 * Convert a registered News Storage row into reporter draft media.
 *
 * @param media Registered media row.
 * @param sourceAssetId Media Desk asset id used for dedupe/UI state.
 * @returns Draft media item.
 */
function toDraftMedia(media: IMediaOut, sourceAssetId: string): IReporterDraftMedia {
  return { id: media.id, url: media.url, sourceAssetId }
}

/**
 * Import independently selectable Media Desk report items into the reporter draft.
 *
 * Each original and edit appears as its own checkbox so both can transfer.
 *
 * @param props Draft media lists, import callbacks, and error/disabled flags.
 * @returns Media Desk package picker UI.
 */
export function MediaDeskImport({
  images,
  videos,
  onImportImages,
  onImportVideos,
  onError,
  disabled = false,
}: IMediaDeskImportProps): JSX.Element {
  const t = useTranslations('admin')
  const [packages, setPackages] = useState<IMediaDeskHandoffPackage[]>([])
  const [packageId, setPackageId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  const importedSourceIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of images) {
      if (item.sourceAssetId) ids.add(item.sourceAssetId)
    }
    for (const item of videos) {
      if (item.sourceAssetId) ids.add(item.sourceAssetId)
    }
    return ids
  }, [images, videos])

  const activePackage = useMemo(
    () => packages.find((item) => item.story.id === packageId) ?? null,
    [packageId, packages],
  )

  const importableAssets = useMemo(
    () => (activePackage?.assets ?? []).filter(isImportableAsset),
    [activePackage],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listMediaDeskHandoffs()
      .then((items) => {
        if (cancelled) return
        setPackages(items)
        setPackageId(items[0]?.story.id ?? '')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        onError(err instanceof Error ? err.message : t('reporter.errors.loadMediaDesk'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onError, t])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [packageId])

  const toggleAsset = useCallback((assetId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(assetId)) next.delete(assetId)
      else next.add(assetId)
      return next
    })
  }, [])

  const handleImport = useCallback(async () => {
    if (!activePackage || selectedIds.size === 0) return
    setImporting(true)
    try {
      const chosen = importableAssets.filter((asset) => selectedIds.has(asset.id))
      const imageRows: IReporterDraftMedia[] = []
      const videoRows: IReporterDraftMedia[] = []
      for (const asset of chosen) {
        if (importedSourceIds.has(asset.id)) continue
        const media = await registerExternalMedia(toRegisterPayload(asset))
        const row = toDraftMedia(media, asset.id)
        if (asset.file_type === 'image') imageRows.push(row)
        else videoRows.push(row)
      }
      if (imageRows.length) onImportImages(imageRows)
      if (videoRows.length) onImportVideos(videoRows)
      setSelectedIds(new Set())
    } catch (err) {
      onError(err instanceof Error ? err.message : t('reporter.errors.importMediaDesk'))
    } finally {
      setImporting(false)
    }
  }, [
    activePackage,
    importableAssets,
    importedSourceIds,
    onError,
    onImportImages,
    onImportVideos,
    selectedIds,
    t,
  ])

  return (
    <section className="rounded border border-neutral-200 bg-neutral-50 p-4">
      <h2 className="text-sm font-medium text-neutral-800">{t('reporter.mediaDesk.heading')}</h2>
      <p className="mt-1 text-xs text-neutral-600">{t('reporter.mediaDesk.hint')}</p>
      <p className="mt-1 text-xs text-neutral-500">{t('reporter.mediaDesk.reportOrderHint')}</p>

      {loading ? (
        <p className="mt-3 text-sm text-neutral-500">{t('reporter.mediaDesk.loading')}</p>
      ) : packages.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">{t('reporter.mediaDesk.empty')}</p>
      ) : (
        <>
          <label className="mt-3 block text-sm font-medium text-neutral-700">
            {t('reporter.mediaDesk.package')}
            <select
              value={packageId}
              disabled={disabled || importing}
              onChange={(event) => setPackageId(event.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              {packages.map((item) => (
                <option key={item.story.id} value={item.story.id}>
                  {item.story.title?.trim() || t('reporter.mediaDesk.untitled')}
                </option>
              ))}
            </select>
          </label>

          {importableAssets.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">{t('reporter.mediaDesk.noAssets')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {importableAssets.map((asset) => (
                <MediaDeskAssetRow
                  key={asset.id}
                  asset={asset}
                  family={importableAssets}
                  checked={selectedIds.has(asset.id)}
                  alreadyImported={importedSourceIds.has(asset.id)}
                  disabled={disabled || importing}
                  onToggle={() => toggleAsset(asset.id)}
                />
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={disabled || importing || selectedIds.size === 0}
            onClick={() => void handleImport()}
            className="mt-3 rounded border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5 disabled:opacity-60"
          >
            {importing
              ? t('reporter.mediaDesk.importing')
              : t('reporter.mediaDesk.importSelected', { count: selectedIds.size })}
          </button>
        </>
      )}
    </section>
  )
}

interface IMediaDeskAssetRowProps {
  asset: IMediaDeskAsset
  family: IMediaDeskAsset[]
  checked: boolean
  alreadyImported: boolean
  disabled: boolean
  onToggle: () => void
}

/**
 * One independently selectable original or edit from a Media Desk package.
 *
 * @param props Asset row state and toggle handler.
 * @returns Checkbox row with preview and version badge.
 */
function MediaDeskAssetRow({
  asset,
  family,
  checked,
  alreadyImported,
  disabled,
  onToggle,
}: IMediaDeskAssetRowProps): JSX.Element {
  const t = useTranslations('admin')
  const badge = mediaDeskVersionLabel(asset, family)
  const label = asset.title?.trim() || asset.original_filename
  const preview = asset.preview_url || asset.url

  return (
    <li className="flex items-center gap-3 rounded border border-neutral-200 bg-white p-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || alreadyImported}
        onChange={onToggle}
        aria-label={t('reporter.mediaDesk.selectAsset', { label, badge })}
      />
      {asset.file_type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-12 w-12 rounded object-cover" />
      ) : (
        <video
          src={`${preview}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="h-12 w-12 rounded bg-black object-cover"
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-neutral-800">{label}</p>
        <p className="text-xs text-neutral-500">
          {badge}
          {alreadyImported ? ` · ${t('reporter.mediaDesk.alreadyImported')}` : ''}
        </p>
      </div>
    </li>
  )
}
