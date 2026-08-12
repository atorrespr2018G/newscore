'use client'

import { MediaThumb } from '@/components/media-thumb'
import {
  isSentToEditorStory,
  type IMediaAsset,
  type IMediaStory,
} from '@/lib/media-editor-client'

const MAX_VISIBLE_SENT_THUMBS = 4

interface ISentNewsPoolProps {
  stories: IMediaStory[]
  assetsById: Map<string, IMediaAsset>
  onOpenWorkspace: (storyId: string) => void
}

/**
 * Resolve the report-order asset ids that were actually sent to the editor.
 *
 * Prefers the recorded handoff list; falls back to current report order only
 * for older packages that were marked ready before sent_asset_ids existed.
 *
 * @param story - Sent story package.
 * @returns Ordered Media Desk asset ids included in the handoff.
 */
function resolveSentAssetIds(story: IMediaStory): string[] {
  if (Array.isArray(story.sent_asset_ids) && story.sent_asset_ids.length > 0) {
    return story.sent_asset_ids
  }
  return story.selected_asset_ids
}

/**
 * Load sent report-order assets that still exist in the library.
 * @param story - Sent story package.
 * @param assetsById - Library assets keyed by id.
 * @returns Assets in the order they were sent.
 */
function resolveSentAssets(
  story: IMediaStory,
  assetsById: Map<string, IMediaAsset>,
): IMediaAsset[] {
  return resolveSentAssetIds(story)
    .map((assetId) => assetsById.get(assetId))
    .filter((asset): asset is IMediaAsset => Boolean(asset))
}

/**
 * Pick the cover as the first picture/video in report order (not “first image”).
 * @param sentAssets - Assets included in the handoff, in report order.
 * @returns First image/video asset, or null when none remain.
 */
function resolveCoverAsset(sentAssets: IMediaAsset[]): IMediaAsset | null {
  return (
    sentAssets.find((asset) => asset.file_type === 'image' || asset.file_type === 'video')
    ?? null
  )
}

/**
 * Editor-style news cards for packages successfully sent to NewsCore.
 *
 * @param props Stories, asset lookup, and workspace reopen handler.
 * @returns News pool panel for the Media Desk News tab.
 */
export function SentNewsPool(props: ISentNewsPoolProps): JSX.Element {
  const { stories, assetsById, onOpenWorkspace } = props
  const sentStories = stories.filter(isSentToEditorStory)

  return (
    <section className="me-panel space-y-5 p-5 md:p-6">
      <div>
        <p className="me-label mb-0">Stored news</p>
        <h2 className="font-serif text-2xl text-brand-ink">News</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pictures and videos from report order that were sent to NewsCore Editor
        </p>
      </div>

      {sentStories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-line px-4 py-8 text-center text-sm text-slate-500">
          No news stored yet. Send a report package from Workspace to see it here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sentStories.map((story) => {
            const sentAssets = resolveSentAssets(story, assetsById)
            return (
              <SentNewsCard
                key={story.id}
                story={story}
                cover={resolveCoverAsset(sentAssets)}
                sentAssets={sentAssets}
                onOpenWorkspace={() => onOpenWorkspace(story.id)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

interface ISentNewsCardProps {
  story: IMediaStory
  cover: IMediaAsset | null
  sentAssets: IMediaAsset[]
  onOpenWorkspace: () => void
}

/**
 * One stored-news card mirroring the Editor News pool row layout.
 *
 * @param props Story row, cover, sent report media, and reopen action.
 * @returns Clickable card for a sent package.
 */
function SentNewsCard(props: ISentNewsCardProps): JSX.Element {
  const { story, cover, sentAssets, onOpenWorkspace } = props
  const title = story.sent_article_title?.trim() || story.title.trim() || 'Untitled'
  const articleId = story.sent_article_id?.trim() || null
  const status = story.sent_article_status ?? story.status
  const mediaCount = story.sent_media_count ?? sentAssets.length
  const previewAssets = sentAssets.slice(0, MAX_VISIBLE_SENT_THUMBS)
  const extraCount = Math.max(0, sentAssets.length - previewAssets.length)

  return (
    <article className="overflow-hidden rounded-xl border border-brand-line bg-white shadow-sm transition-colors hover:border-slate-300">
      <button type="button" onClick={onOpenWorkspace} className="w-full cursor-pointer text-left">
        <div className="relative aspect-[16/10] bg-brand-mist">
          {cover ? (
            <MediaThumb asset={cover} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-slate-400">
              No media
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-brand-line p-3">
          <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-brand-ink">
            {title}
          </h3>
          {previewAssets.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {previewAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="relative h-10 w-10 overflow-hidden rounded-md border border-brand-line bg-brand-mist"
                  title={asset.title ?? asset.original_filename}
                >
                  <MediaThumb asset={asset} />
                </div>
              ))}
              {extraCount > 0 ? (
                <span className="text-[11px] font-medium text-slate-500">+{extraCount}</span>
              ) : null}
            </div>
          ) : null}
          <dl className="space-y-1 text-xs text-slate-600">
            <div>
              <dt className="inline font-medium text-slate-500">Package ID: </dt>
              <dd className="inline font-mono text-[11px] text-slate-700">{story.id}</dd>
            </div>
            {articleId ? (
              <div>
                <dt className="inline font-medium text-slate-500">Article ID: </dt>
                <dd className="inline font-mono text-[11px] text-slate-700">{articleId}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline font-medium text-slate-500">Status: </dt>
              <dd className="inline capitalize">{status}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-slate-500">Sent media: </dt>
              <dd className="inline">{mediaCount}</dd>
            </div>
            {story.sent_at ? (
              <div>
                <dt className="inline font-medium text-slate-500">Sent: </dt>
                <dd className="inline">{formatSentAt(story.sent_at)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </button>
    </article>
  )
}

/**
 * Format an ISO timestamp for the sent-news card.
 * @param value - ISO datetime string.
 * @returns Locale date/time string, or the raw value when parsing fails.
 */
function formatSentAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
