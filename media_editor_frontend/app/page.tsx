'use client'

import dynamic from 'next/dynamic'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { DocumentTitleField } from '@/components/document-title-field'
import { RichTextEditor, type IRichTextEditorHandle } from '@/components/rich-text-editor'
import { StoryTaxonomyFields } from '@/components/story-taxonomy-fields'
import { StoryUploadControl } from '@/components/story-upload-control'
import { StoryWorkspace } from '@/components/story-workspace'
import { SentNewsPool } from '@/components/sent-news-pool'
import { VideoEditor } from '@/components/video-editor'
import { VideoMergePicker } from '@/components/video-merge-picker'
import {
  clearAccessToken,
  createStory,
  deleteAsset,
  getAccessToken,
  IMediaAsset,
  IMediaStory,
  isSentToEditorStory,
  listAssets,
  listStories,
  login,
  mergeVideos,
  normalizeStoryTaxonomy,
  removeBackground,
  sendStoryToEditor,
  updateAsset,
  updateStory,
} from '@/lib/media-editor-client'
import {
  toggleCategorySlug,
  validateStoryTaxonomy,
} from '@/lib/taxonomy/story-taxonomy'
import {
  MAX_TITLE_LENGTH,
  toDescriptionHtml,
  validateMediaMetadata,
} from '@/lib/media-metadata'
import {
  adoptEditedDerivative,
  expandPoolWithDetachedEdits,
  sanitizePoolIds,
  sanitizeSelectedIds,
} from '@/lib/story-selection'

/**
 * Whether local story state already moved past the payload that was just saved.
 * @param local - Current in-memory story.
 * @param savedPayload - Payload that was sent to the API.
 * @returns True when applying the save response would clobber a newer edit.
 */
function storyAheadOfSave(local: IMediaStory, savedPayload: IMediaStory): boolean {
  return (
    local.market_code !== savedPayload.market_code
    || local.town_id !== savedPayload.town_id
    || local.county_id !== savedPayload.county_id
    || local.international_potential !== savedPayload.international_potential
    || local.status !== savedPayload.status
    || local.category_slugs.join('\0') !== savedPayload.category_slugs.join('\0')
    || local.pool_asset_ids.join('\0') !== savedPayload.pool_asset_ids.join('\0')
    || local.selected_asset_ids.join('\0') !== savedPayload.selected_asset_ids.join('\0')
  )
}

const RICH_TEXT_LABELS = {
  bold: 'Bold',
  italic: 'Italic',
  heading2: 'H2',
  heading3: 'H3',
  bulletList: 'Bullets',
  orderedList: 'Numbers',
  blockquote: 'Quote',
  link: 'Link',
  unlink: 'Unlink',
  linkPrompt: 'Enter link URL',
  undo: 'Undo',
  redo: 'Redo',
}

const ImageEditor = dynamic(
  () => import('@/components/image-editor').then((module) => module.ImageEditor),
  { ssr: false },
)

/** Render the independent reporter story media workspace. */
export default function MediaLibraryPage(): JSX.Element {
  const [assets, setAssets] = useState<IMediaAsset[]>([])
  const [stories, setStories] = useState<IMediaStory[]>([])
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null)
  const [selected, setSelected] = useState<IMediaAsset | null>(null)
  const [imageEditorAsset, setImageEditorAsset] = useState<IMediaAsset | null>(null)
  const [videoEditorAsset, setVideoEditorAsset] = useState<IMediaAsset | null>(null)
  const [message, setMessage] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removingBackground, setRemovingBackground] = useState(false)
  const [mergingVideos, setMergingVideos] = useState(false)
  const [mergePickerOpen, setMergePickerOpen] = useState(false)
  const [exportAssetIds, setExportAssetIds] = useState<Set<string>>(() => new Set())
  const [sendingToEditor, setSendingToEditor] = useState(false)
  const [deskTab, setDeskTab] = useState<'workspace' | 'news'>('workspace')

  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? null
  const sentNewsCount = useMemo(
    () => stories.filter(isSentToEditorStory).length,
    [stories],
  )

  useEffect(() => setAuthenticated(Boolean(getAccessToken())), [])
  useEffect(() => {
    if (authenticated) void refresh()
  }, [authenticated])

  // Keep Edition unlocked: prefer current selection if it belongs to this story.
  useEffect(() => {
    if (!activeStory) {
      setSelected(null)
      return
    }
    setSelected((current) => {
      if (current && assetsById.has(current.id)) {
        const inStory =
          activeStory.selected_asset_ids.includes(current.id)
          || activeStory.pool_asset_ids.includes(current.id)
        if (inStory) {
          const fresh = assetsById.get(current.id)
          if (!fresh) return current
          // Avoid swapping the object on every stories refresh while typing.
          if (
            fresh.title === current.title
            && fresh.description === current.description
            && fresh.preview_url === current.preview_url
          ) {
            return current
          }
          return fresh
        }
      }
      const fallbackId = activeStory.selected_asset_ids[0] ?? activeStory.pool_asset_ids[0]
      return fallbackId ? (assetsById.get(fallbackId) ?? null) : null
    })
  }, [activeStory, assetsById])

  const exportReportKeyRef = useRef('')
  // Source of truth for click handlers. Do not assign from `stories` during render —
  // a concurrent re-render with stale state would wipe an optimistic toggle.
  const storiesRef = useRef(stories)
  const storySaveGenRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    storiesRef.current = stories
  }, [stories])

  // Sync export checkboxes with report order without re-checking after the user clears them.
  useEffect(() => {
    if (!activeStory) {
      setExportAssetIds(new Set())
      exportReportKeyRef.current = ''
      return
    }
    const nextKey = `${activeStory.id}:${activeStory.selected_asset_ids.join('\0')}`
    const prevKey = exportReportKeyRef.current
    exportReportKeyRef.current = nextKey
    const prevStoryId = prevKey.split(':')[0] ?? ''
    const prevIds = (prevKey.split(':')[1] ?? '').split('\0').filter(Boolean)
    if (!prevKey || activeStory.id !== prevStoryId) {
      setExportAssetIds(new Set(activeStory.selected_asset_ids))
      return
    }
    const prevSet = new Set(prevIds)
    const reportSet = new Set(activeStory.selected_asset_ids)
    setExportAssetIds((current) => {
      const next = new Set<string>()
      for (const id of current) {
        if (reportSet.has(id)) next.add(id)
      }
      for (const id of activeStory.selected_asset_ids) {
        if (!prevSet.has(id)) next.add(id)
      }
      return next
    })
  }, [activeStory])

  async function refresh(): Promise<void> {
    setBusy(true)
    try {
      const [newAssets, newStories] = await Promise.all([listAssets(), listStories()])
      const byId = new Map(newAssets.map((asset) => [asset.id, asset]))
      const cleanedStories = newStories.map((story) => {
        const normalized = normalizeStoryTaxonomy(story)
        const expandedPool = expandPoolWithDetachedEdits(
          sanitizePoolIds(normalized.pool_asset_ids, byId),
          newAssets,
          byId,
        )
        const poolIds = sanitizePoolIds(expandedPool, byId)
        return {
          ...normalized,
          pool_asset_ids: poolIds,
          selected_asset_ids: sanitizeSelectedIds(normalized.selected_asset_ids, poolIds, byId),
        }
      })
      setAssets(newAssets)
      setStories(cleanedStories)
      setActiveStoryId((current) => current ?? cleanedStories[0]?.id ?? null)
      setSelected((current) => newAssets.find((asset) => asset.id === current?.id) ?? null)
      setMessage('')
      // Persist expanded pools so former nested edits become standalone pool items.
      for (const story of cleanedStories) {
        const original = newStories.find((item) => item.id === story.id)
        if (!original) continue
        if (original.pool_asset_ids.join('\0') === story.pool_asset_ids.join('\0')) continue
        void updateStory(story).catch(() => undefined)
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to load media library'
      if (text.includes('sign in again') || !getAccessToken()) {
        clearAccessToken()
        setAuthenticated(false)
      }
      setMessage(text)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Persist a story after sanitizing pool/report IDs against a known asset map.
   * @param next - Story patch to save.
   * @param lookup - Asset lookup; pass a fresh map when a new edit is not in React state yet.
   */
  async function persistStory(
    next: IMediaStory,
    lookup: Map<string, IMediaAsset> = assetsById,
  ): Promise<void> {
    const poolIds = sanitizePoolIds(next.pool_asset_ids, lookup)
    const cleaned = normalizeStoryTaxonomy({
      ...next,
      pool_asset_ids: poolIds,
      selected_asset_ids: sanitizeSelectedIds(next.selected_asset_ids, poolIds, lookup),
    })
    const saveGen = (storySaveGenRef.current.get(cleaned.id) ?? 0) + 1
    storySaveGenRef.current.set(cleaned.id, saveGen)
    // Apply locally first so Remove/reorder/add update the UI immediately. Without this,
    // storyAheadOfSave treats the pre-save state as "newer" and keeps the old report list.
    storiesRef.current = storiesRef.current.map((story) =>
      story.id === cleaned.id ? cleaned : story,
    )
    setStories(storiesRef.current)
    try {
      const saved = await updateStory(cleaned)
      // Drop stale responses from an older in-flight save for this story.
      if (storySaveGenRef.current.get(cleaned.id) !== saveGen) return
      setStories((current) =>
        current.map((story) => {
          if (story.id !== saved.id) return story
          // Skip stale responses when a newer local patch already landed.
          if (storyAheadOfSave(story, cleaned)) return story
          return normalizeStoryTaxonomy(saved)
        }),
      )
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to update story'
      if (text.includes('sign in again') || !getAccessToken()) {
        clearAccessToken()
        setAuthenticated(false)
      }
      throw error
    }
  }

  /**
   * Toggle one category on the active story and persist. Uses storiesRef so rapid
   * clicks always flip from the latest selection, not a stale React closure.
   * @param slug - Category slug to turn on or off.
   */
  function handleToggleCategory(slug: string): void {
    if (!activeStoryId) return
    const base = storiesRef.current.find((story) => story.id === activeStoryId)
    if (!base) return
    const nextSlugs = toggleCategorySlug(base.category_slugs ?? [], slug)
    const keepReady = Boolean(base.sent_article_id) || base.status === 'ready'
    const nextStory: IMediaStory = {
      ...base,
      category_slugs: nextSlugs,
      status: keepReady ? 'ready' : 'draft',
    }
    void persistStory(nextStory).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Unable to save categories')
    })
  }

  /**
   * Patch location / international fields on the active story and persist.
   * @param partial - Fields to merge onto the latest story snapshot.
   */
  function handleTaxonomyPatch(partial: Partial<IMediaStory>): void {
    if (!activeStoryId) return
    const base = storiesRef.current.find((story) => story.id === activeStoryId)
    if (!base) return
    const keepReady = Boolean(base.sent_article_id) || base.status === 'ready'
    const nextStory: IMediaStory = {
      ...base,
      ...partial,
      status: keepReady ? 'ready' : 'draft',
    }
    void persistStory(nextStory).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Unable to save placement')
    })
  }

  async function handleEditedDerivative(source: IMediaAsset, derivative: IMediaAsset): Promise<void> {
    const nextAssets = [derivative, ...assets.filter((asset) => asset.id !== derivative.id)]
    const nextAssetsById = new Map(nextAssets.map((asset) => [asset.id, asset]))
    setAssets(nextAssets)
    if (!activeStory) {
      await refresh()
      return
    }
    const nextLists = adoptEditedDerivative(
      sanitizePoolIds(activeStory.pool_asset_ids, nextAssetsById),
      activeStory.selected_asset_ids,
      source.id,
      derivative.id,
      source.id,
    )
    // Use nextAssetsById so sanitize does not drop the brand-new derivative from the report.
    await persistStory(
      {
        ...activeStory,
        pool_asset_ids: nextLists.poolIds,
        selected_asset_ids: nextLists.selectedIds,
        status: 'draft',
      },
      nextAssetsById,
    )
    setSelected(derivative)
  }

  /**
   * Open the image or video studio for an asset, optionally via the version picker.
   * @param asset - Selected report media asset.
   */
  function openStudio(asset: IMediaAsset): void {
    if (asset.file_type === 'video') {
      setVideoEditorAsset(asset)
      return
    }
    setImageEditorAsset(asset)
  }

  async function openMediaEditor(asset: IMediaAsset): Promise<void> {
    setImageEditorAsset(null)
    setVideoEditorAsset(null)
    // Edits create a new independent picture/video — never nest inside the source.
    openStudio(asset)
  }

  /** Videos available to merge: report order first, then other pool videos. */
  const mergeCandidateVideos = useMemo(() => {
    if (!activeStory) return [] as IMediaAsset[]
    const seen = new Set<string>()
    const ordered: IMediaAsset[] = []
    for (const assetId of activeStory.selected_asset_ids) {
      const asset = assetsById.get(assetId)
      if (!asset || asset.file_type !== 'video' || seen.has(asset.id)) continue
      seen.add(asset.id)
      ordered.push(asset)
    }
    for (const assetId of activeStory.pool_asset_ids) {
      const asset = assetsById.get(assetId)
      if (!asset || asset.file_type !== 'video' || seen.has(asset.id)) continue
      seen.add(asset.id)
      ordered.push(asset)
    }
    return ordered
  }, [activeStory, assetsById])

  /**
   * Report-order images and videos usable as picture inserts (base clip excluded).
   * Pool-only media is appended after report order for anything not yet in the report.
   */
  const pictureInsertCandidates = useMemo(() => {
    if (!activeStory || !videoEditorAsset) return [] as IMediaAsset[]
    const seen = new Set<string>()
    const ordered: IMediaAsset[] = []
    for (const assetId of activeStory.selected_asset_ids) {
      if (assetId === videoEditorAsset.id || seen.has(assetId)) continue
      const asset = assetsById.get(assetId)
      if (!asset || (asset.file_type !== 'image' && asset.file_type !== 'video')) continue
      seen.add(asset.id)
      ordered.push(asset)
    }
    for (const assetId of activeStory.pool_asset_ids) {
      if (assetId === videoEditorAsset.id || seen.has(assetId)) continue
      const asset = assetsById.get(assetId)
      if (!asset || (asset.file_type !== 'image' && asset.file_type !== 'video')) continue
      seen.add(asset.id)
      ordered.push(asset)
    }
    return ordered
  }, [activeStory, assetsById, videoEditorAsset])

  /**
   * Merge the user-selected videos into one file and place it in the report.
   * @param videoIds - Chosen asset ids in merge order.
   */
  async function mergeSelectedVideos(videoIds: string[]): Promise<void> {
    if (!activeStory) return
    if (videoIds.length < 2) {
      setMessage('Select at least two videos to merge')
      return
    }
    setMergingVideos(true)
    setMessage('Merging videos… this can take a minute')
    try {
      const merged = await mergeVideos(videoIds)
      const mergedIds = new Set(videoIds)
      const keptReportIds = activeStory.selected_asset_ids.filter((assetId) => {
        const asset = assetsById.get(assetId)
        if (!asset) return false
        if (asset.file_type !== 'video') return true
        return !mergedIds.has(asset.id)
      })
      const nextPool = activeStory.pool_asset_ids.includes(merged.id)
        ? activeStory.pool_asset_ids
        : [...activeStory.pool_asset_ids, merged.id]
      const nextAssets = [merged, ...assets.filter((asset) => asset.id !== merged.id)]
      const nextAssetsById = new Map(nextAssets.map((asset) => [asset.id, asset]))
      setAssets(nextAssets)
      await persistStory(
        {
          ...activeStory,
          pool_asset_ids: nextPool,
          selected_asset_ids: [...keptReportIds, merged.id],
          status: 'draft',
        },
        nextAssetsById,
      )
      setSelected(merged)
      setMergePickerOpen(false)
      setMessage('Merged video created and placed in the report')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to merge videos')
    } finally {
      setMergingVideos(false)
    }
  }

  if (!authenticated) return <LoginScreen onSuccess={() => setAuthenticated(true)} />

  return (
    <main className="me-shell">
      <header className="me-panel mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-7">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-sm font-bold tracking-[0.14em] text-white">
            NS
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">NewsCore</p>
            <h1 className="font-serif text-3xl text-brand-ink md:text-4xl">Media Desk</h1>
            <p className="mt-1 text-sm text-slate-500">
              Per-story originals pool and ordered report pictures
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-xl border border-brand-line bg-brand-paper px-3 py-2 text-xs text-slate-600 sm:block">
            {stories.length} stories · {assets.length} assets
            {busy ? ' · refreshing' : ''}
          </div>
          <button
            className="me-btn-secondary"
            onClick={() => {
              clearAccessToken()
              setAuthenticated(false)
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {message && (
        <div className="mb-4 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-ink shadow-sm">
          {message}
        </div>
      )}

      <DeskTabBar
        activeTab={deskTab}
        sentCount={sentNewsCount}
        onTabChange={setDeskTab}
      />

      {deskTab === 'news' ? (
        <SentNewsPool
          stories={stories}
          assetsById={assetsById}
          onOpenWorkspace={(storyId) => {
            setActiveStoryId(storyId)
            setDeskTab('workspace')
          }}
        />
      ) : (
      <div className="space-y-6">
        <StoryPicker
          stories={stories}
          activeStoryId={activeStoryId}
          onSelect={setActiveStoryId}
          onCreated={(story) => {
            const normalized = normalizeStoryTaxonomy(story)
            setStories((current) => [normalized, ...current])
            setActiveStoryId(normalized.id)
          }}
          onError={setMessage}
        />

        {activeStory ? (
          <>
            <StoryTaxonomyFields
              story={activeStory}
              onPatch={handleTaxonomyPatch}
              onToggleCategory={handleToggleCategory}
            />
            <AssetInspector asset={selected} onUpdated={refresh} onError={setMessage} />
            <StoryWorkspace
              story={activeStory}
              assets={assets}
              assetsById={assetsById}
              selectedAssetId={selected?.id ?? null}
              exportAssetIds={exportAssetIds}
              onSelectAsset={setSelected}
              onToggleExportAsset={(assetId) => {
                setExportAssetIds((current) => {
                  const next = new Set(current)
                  if (next.has(assetId)) next.delete(assetId)
                  else next.add(assetId)
                  return next
                })
              }}
              onEditImage={(asset) => {
                setSelected(asset)
                void openMediaEditor(asset)
              }}
              onEditVideo={(asset) => {
                setSelected(asset)
                void openMediaEditor(asset)
              }}
              onMergeVideos={async () => {
                if (mergeCandidateVideos.length < 2) {
                  setMessage('Add at least two videos to this story before merging')
                  return
                }
                setMergePickerOpen(true)
              }}
              removingBackground={removingBackground}
              mergingVideos={mergingVideos}
              mergeCandidateCount={mergeCandidateVideos.length}
              onRemoveBackground={(asset) => {
                void (async () => {
                  setRemovingBackground(true)
                  setMessage('Removing background… this can take a few seconds')
                  try {
                    setSelected(asset)
                    const derivative = await removeBackground(asset.id)
                    await handleEditedDerivative(asset, derivative)
                    setMessage(
                      activeStory.selected_asset_ids.includes(asset.id)
                        ? 'Saved as a new independent picture in Report order'
                        : 'Saved as a new independent picture in the pool',
                    )
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Background removal failed')
                  } finally {
                    setRemovingBackground(false)
                  }
                })()
              }}
              onDeleteAsset={(asset) => {
                void (async () => {
                  const label = asset.title ?? asset.original_filename
                  if (
                    !window.confirm(
                      `Permanently delete "${label}"? This cannot be undone.`,
                    )
                  ) {
                    return
                  }
                  try {
                    await deleteAsset(asset.id)
                    if (selected?.id === asset.id) {
                      setSelected(null)
                    }
                    await refresh()
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Delete failed')
                  }
                })()
              }}
              onStoryChange={persistStory}
              onError={setMessage}
              poolUploadControl={
                <StoryUploadControl
                  storyId={activeStory.id}
                  onUploaded={(asset) => {
                    setAssets((current) => [asset, ...current])
                    setStories((current) =>
                      current.map((story) =>
                        story.id !== activeStory.id
                          ? story
                          : {
                              ...story,
                              pool_asset_ids: story.pool_asset_ids.includes(asset.id)
                                ? story.pool_asset_ids
                                : [...story.pool_asset_ids, asset.id],
                              status: 'draft',
                            },
                      ),
                    )
                    setSelected(asset)
                  }}
                  onError={setMessage}
                />
              }
            />
            <ReadyControls
              story={activeStory}
              exportAssetIds={exportAssetIds}
              sending={sendingToEditor}
              onPersist={persistStory}
              onError={setMessage}
              onSendToEditor={async () => {
                const taxonomyError = validateStoryTaxonomy(activeStory.category_slugs)
                if (taxonomyError) {
                  setMessage(taxonomyError)
                  return
                }
                const orderedIds = activeStory.selected_asset_ids.filter((id) =>
                  exportAssetIds.has(id),
                )
                if (orderedIds.length === 0) {
                  setMessage('Check at least one picture/video in report order')
                  return
                }
                setSendingToEditor(true)
                try {
                  const result = await sendStoryToEditor(activeStory.id, orderedIds)
                  setMessage(
                    `Sent “${result.article_title}” — stored under News. Categories stay editable here and sync to the Editor draft.`,
                  )
                  await refresh()
                  // Stay on Workspace so markets/categories remain editable after send.
                  setDeskTab('workspace')
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : 'Unable to send story to editor',
                  )
                } finally {
                  setSendingToEditor(false)
                }
              }}
            />
          </>
        ) : (
          <section className="me-panel px-6 py-16 text-center">
            <p className="font-serif text-3xl text-brand-ink">Create a story to begin</p>
            <p className="mt-2 text-sm text-slate-500">
              Each news item gets its own originals pool and a separate ordered report collection.
            </p>
          </section>
        )}
      </div>
      )}

      {imageEditorAsset && (
        <ImageEditor
          asset={imageEditorAsset}
          onClose={() => setImageEditorAsset(null)}
          onSaved={async (derivative) => {
            const sourceInReport = Boolean(
              activeStory?.selected_asset_ids.includes(imageEditorAsset.id),
            )
            await handleEditedDerivative(imageEditorAsset, derivative)
            setMessage(
              sourceInReport
                ? 'Saved as a new independent picture in Report order'
                : 'Saved as a new independent picture in the pool',
            )
          }}
        />
      )}

      {videoEditorAsset && (
        <VideoEditor
          asset={videoEditorAsset}
          candidateMedia={pictureInsertCandidates}
          onClose={() => setVideoEditorAsset(null)}
          onSaved={async (derivative) => {
            const sourceInReport = Boolean(
              activeStory?.selected_asset_ids.includes(videoEditorAsset.id),
            )
            await handleEditedDerivative(videoEditorAsset, derivative)
            setMessage(
              sourceInReport
                ? 'Saved as a new independent video in Report order'
                : 'Saved as a new independent video in the pool',
            )
          }}
        />
      )}

      {mergePickerOpen && (
        <VideoMergePicker
          videos={mergeCandidateVideos}
          busy={mergingVideos}
          onClose={() => {
            if (!mergingVideos) setMergePickerOpen(false)
          }}
          onMerge={mergeSelectedVideos}
        />
      )}
    </main>
  )
}

interface ILoginScreenProps {
  onSuccess: () => void
}

type DeskTabType = 'workspace' | 'news'

interface IDeskTabBarProps {
  activeTab: DeskTabType
  sentCount: number
  onTabChange: (tab: DeskTabType) => void
}

const DESK_TAB_CLASS = 'border-b-2 px-1 pb-2 text-sm font-medium transition-colors'

/**
 * Top-level Media Desk switcher between the report workspace and stored news.
 *
 * @param props Active tab, sent-news badge count, and change handler.
 * @returns Tab bar UI.
 */
function DeskTabBar(props: IDeskTabBarProps): JSX.Element {
  const { activeTab, sentCount, onTabChange } = props
  return (
    <div className="mb-6 flex gap-6 border-b border-brand-line" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'workspace'}
        onClick={() => onTabChange('workspace')}
        className={`${DESK_TAB_CLASS} ${
          activeTab === 'workspace'
            ? 'border-brand text-brand'
            : 'border-transparent text-slate-500 hover:text-brand-ink'
        }`}
      >
        Workspace
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'news'}
        onClick={() => onTabChange('news')}
        className={`${DESK_TAB_CLASS} ${
          activeTab === 'news'
            ? 'border-brand text-brand'
            : 'border-transparent text-slate-500 hover:text-brand-ink'
        }`}
      >
        News
        {sentCount > 0 ? (
          <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
            {sentCount}
          </span>
        ) : null}
      </button>
    </div>
  )
}

/** Authenticate the independent application against NewsCore's auth API. */
function LoginScreen({ onSuccess }: ILoginScreenProps): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      onSuccess()
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-brand/10 to-transparent" />
      <div className="me-panel relative w-full max-w-md overflow-hidden">
        <div className="border-b border-brand-line bg-brand-ink px-8 py-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-300">NewsCore</p>
          <h1 className="mt-2 font-serif text-4xl">Media Desk</h1>
          <p className="mt-2 text-sm text-slate-300">Sign in with your NewsCore editorial account.</p>
        </div>
        <form className="space-y-4 px-8 py-8" onSubmit={submit}>
          <div>
            <label className="me-label" htmlFor="email">Email</label>
            <input
              id="email"
              aria-label="Email"
              className="me-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="me-label" htmlFor="password">Password</label>
            <input
              id="password"
              aria-label="Password"
              className="me-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="me-btn-primary w-full" disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Enter workspace'}
          </button>
        </form>
      </div>
    </main>
  )
}

interface IStoryPickerProps {
  stories: IMediaStory[]
  activeStoryId: string | null
  onSelect: (storyId: string) => void
  onCreated: (story: IMediaStory) => void
  onError: (message: string) => void
}

/** Create and switch between reporter story packages. */
function StoryPicker({
  stories,
  activeStoryId,
  onSelect,
  onCreated,
  onError,
}: IStoryPickerProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  async function create(): Promise<void> {
    if (!title.trim()) return
    setCreating(true)
    try {
      onCreated(await createStory(title.trim()))
      setTitle('')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to create story')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="me-panel p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="me-label mb-0">Story package</p>
          <h2 className="font-serif text-3xl text-brand-ink">News assignments</h2>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="me-input md:flex-1"
          placeholder="Story title (e.g. City hall budget vote)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="me-btn-primary whitespace-nowrap" disabled={!title.trim() || creating} onClick={() => void create()}>
          {creating ? 'Creating…' : 'New story'}
        </button>
      </div>
      {stories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {stories.map((story) => {
            const active = story.id === activeStoryId
            return (
              <button
                key={story.id}
                type="button"
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  active ? 'border-brand bg-brand-soft text-brand' : 'border-brand-line bg-white text-slate-600'
                }`}
                onClick={() => onSelect(story.id)}
              >
                {story.title}
                <span className="ml-2 text-xs opacity-70">
                  {story.selected_asset_ids.length}/{story.pool_asset_ids.length} · {story.status}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

interface IReadyControlsProps {
  story: IMediaStory
  exportAssetIds: ReadonlySet<string>
  sending: boolean
  onPersist: (story: IMediaStory) => Promise<void>
  onSendToEditor: () => Promise<void>
  onError: (message: string) => void
}

/** Send checked report items to NewsCore Editor, or mark the package ready. */
function ReadyControls({
  story,
  exportAssetIds,
  sending,
  onPersist,
  onSendToEditor,
  onError,
}: IReadyControlsProps): JSX.Element {
  const checkedCount = story.selected_asset_ids.filter((id) => exportAssetIds.has(id)).length

  async function markReady(): Promise<void> {
    const taxonomyError = validateStoryTaxonomy(story.category_slugs)
    if (taxonomyError) {
      onError(taxonomyError)
      return
    }
    try {
      await onPersist({ ...story, status: 'ready' })
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to mark story ready')
    }
  }

  return (
    <section className="me-panel flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
      <div>
        <p className="me-label mb-0">Send</p>
        <h2 className="font-serif text-2xl text-brand-ink">Report package</h2>
        <p className="mt-1 text-sm text-slate-500">
          {checkedCount} checked of {story.selected_asset_ids.length} in report order · {story.status}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="me-btn-primary"
          disabled={sending || checkedCount === 0}
          onClick={() => void onSendToEditor()}
        >
          {sending ? 'Sending…' : `Send to Editor (${checkedCount})`}
        </button>
        <button
          type="button"
          className="rounded-xl border border-brand-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50"
          disabled={story.selected_asset_ids.length === 0 || story.status === 'ready' || sending}
          onClick={() => void markReady()}
        >
          {story.status === 'ready' ? 'Ready for editors' : 'Mark report ready'}
        </button>
      </div>
    </section>
  )
}

interface IAssetInspectorProps {
  asset: IMediaAsset | null
  onUpdated: () => Promise<void>
  onError: (message: string) => void
}

/** Edit headline and description only; picture actions live in report order. */
function AssetInspector({ asset, onUpdated, onError }: IAssetInspectorProps): JSX.Element {
  const assetId = asset?.id ?? null
  const [draftAssetId, setDraftAssetId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('<p></p>')
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')
  const titleRef = useRef(title)
  const descriptionRef = useRef(description)
  const descriptionEditorRef = useRef<IRichTextEditorHandle>(null)
  const editorEnabled = Boolean(asset)

  // Sync during render so TipTap mounts with the saved HTML (not an empty first paint).
  if (assetId !== draftAssetId) {
    const nextTitle = asset?.title ?? ''
    const nextDescription = toDescriptionHtml(asset?.description)
    setDraftAssetId(assetId)
    setTitle(nextTitle)
    setDescription(nextDescription)
    titleRef.current = nextTitle
    descriptionRef.current = nextDescription
    setSaveNotice('')
  }

  function handleTitleChange(next: string): void {
    titleRef.current = next
    setTitle(next)
  }

  function handleDescriptionChange(next: string): void {
    descriptionRef.current = next
    setDescription(next)
  }

  async function saveEdition(): Promise<void> {
    if (!asset) {
      onError('Select a picture first to edit its headline and description')
      return
    }
    // Read live TipTap HTML — clicking Save blurs the editor before React state settles.
    const liveDescription = descriptionEditorRef.current?.getHTML() ?? descriptionRef.current
    const liveTitle = titleRef.current
    descriptionRef.current = liveDescription
    setDescription(liveDescription)
    const validationError = validateMediaMetadata(liveTitle, liveDescription)
    if (validationError) {
      onError(validationError)
      setSaveNotice('')
      return
    }
    setSaving(true)
    setSaveNotice('')
    try {
      await updateAsset(asset.id, { title: liveTitle.trim(), description: liveDescription })
      await onUpdated()
      setSaveNotice('Edition saved')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to save edition')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="me-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line px-5 py-4 md:px-6">
        <div>
          <p className="me-label mb-0">Edition</p>
          <h2 className="font-serif text-2xl text-brand-ink">Headline & description</h2>
          <p className="mt-1 text-sm text-slate-500">
            {asset
              ? `Editing text for ${asset.title ?? asset.original_filename}`
              : 'Select a picture from the report order to write its headline and description.'}
          </p>
          {saveNotice ? <p className="mt-1 text-sm text-emerald-700">{saveNotice}</p> : null}
        </div>
        <button
          type="button"
          className="me-btn-primary"
          disabled={!editorEnabled || saving}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void saveEdition()}
        >
          {saving ? 'Saving edition…' : 'Save edition'}
        </button>
      </div>

      <div className={`space-y-5 px-5 py-5 md:px-6 ${editorEnabled ? '' : 'opacity-60'}`}>
        <div className="min-w-0">
          <span className="block text-sm font-medium text-slate-700">Headline</span>
          <DocumentTitleField
            value={title}
            onChange={handleTitleChange}
            placeholder="Write a headline…"
            ariaLabel="Headline"
            maxLength={MAX_TITLE_LENGTH}
            formatCount={(count, max) => `${count}/${max}`}
            disabled={!editorEnabled}
          />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-medium text-slate-700">Description</span>
          <p className="mt-0.5 text-xs text-slate-500">
            At least 10 characters · click Save edition to keep your changes
          </p>
          <RichTextEditor
            ref={descriptionEditorRef}
            key={asset?.id ?? 'no-asset'}
            value={description}
            onChange={handleDescriptionChange}
            labels={RICH_TEXT_LABELS}
            ariaLabel="Description"
            editable={editorEnabled}
          />
        </div>
      </div>
    </section>
  )
}
