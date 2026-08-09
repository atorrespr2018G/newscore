'use client'

import type { IMediaAsset } from '@/lib/media-editor-client'

interface IMediaThumbProps {
  asset: IMediaAsset
  className?: string
}

/**
 * Whether preview_url points at a still image distinct from the media file.
 * @param asset - Library asset.
 * @returns True when a JPEG/PNG poster should be shown.
 */
function hasStillPreview(asset: IMediaAsset): boolean {
  const preview = asset.preview_url
  if (!preview || preview === asset.url) return false
  return /\.(jpe?g|png|webp)(\?|$)/i.test(preview)
}

/**
 * Still thumbnail for images and video posters; falls back to a muted video frame.
 * @param props - Asset and optional class names for the media element.
 * @returns Cover media for story cards and version pickers.
 */
export function MediaThumb({ asset, className = '' }: IMediaThumbProps): JSX.Element {
  const mediaClass = `pointer-events-none absolute inset-0 h-full w-full object-cover ${className}`
  if (asset.file_type === 'image' || hasStillPreview(asset)) {
    return (
      <img
        alt={asset.alt_text ?? asset.title ?? asset.original_filename}
        className={mediaClass}
        draggable={false}
        src={asset.preview_url ?? asset.url}
      />
    )
  }
  if (asset.file_type === 'video') {
    return (
      <video
        className={mediaClass}
        draggable={false}
        muted
        playsInline
        preload="metadata"
        src={asset.url}
        poster={asset.preview_url && asset.preview_url !== asset.url ? asset.preview_url : undefined}
      />
    )
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-brand-mist text-xs text-slate-500">
      Audio
    </div>
  )
}
