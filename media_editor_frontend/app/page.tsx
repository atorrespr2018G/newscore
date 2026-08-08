'use client'

import dynamic from 'next/dynamic'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { DocumentTitleField } from '@/components/document-title-field'
import { RichTextEditor } from '@/components/rich-text-editor'
import { StoryUploadControl } from '@/components/story-upload-control'
import { StoryWorkspace } from '@/components/story-workspace'
import { VersionPicker } from '@/components/version-picker'
import { VideoEditor } from '@/components/video-editor'
import {
  clearAccessToken,
  createStory,
  deleteAsset,
  getAccessToken,
  IMediaAsset,
  IMediaStory,
  listAssets,
  listAssetVersions,
  listStories,
  login,
  removeBackground,
  updateAsset,
  updateStory,
} from '@/lib/media-editor-client'
import {
  MAX_TITLE_LENGTH,
  toDescriptionHtml,
  validateMediaMetadata,
} from '@/lib/media-metadata'
import {
  adoptEditedDerivative,
  getRootId,
  sanitizePoolIds,
  sanitizeSelectedIds,
} from '@/lib/story-selection'

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
  const [versionPickerAsset, setVersionPickerAsset] = useState<IMediaAsset | null>(null)
  const [message, setMessage] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removingBackground, setRemovingBackground] = useState(false)

  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? null

  useEffect(() => setAuthenticated(Boolean(getAccessToken())), [])
  useEffect(() => {
    if (authenticated) void refresh()
  }, [authenticated])

  async function refresh(): Promise<void> {
    setBusy(true)
    try {
      const [newAssets, newStories] = await Promise.all([listAssets(), listStories()])
      const byId = new Map(newAssets.map((asset) => [asset.id, asset]))
      const cleanedStories = newStories.map((story) => {
        const poolIds = sanitizePoolIds(story.pool_asset_ids, byId)
        return {
          ...story,
          pool_asset_ids: poolIds,
          selected_asset_ids: sanitizeSelectedIds(story.selected_asset_ids, poolIds, byId),
        }
      })
      setAssets(newAssets)
      setStories(cleanedStories)
      setActiveStoryId((current) => current ?? cleanedStories[0]?.id ?? null)
      setSelected((current) => newAssets.find((asset) => asset.id === current?.id) ?? null)
      setMessage('')
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
    const cleaned = {
      ...next,
      pool_asset_ids: poolIds,
      selected_asset_ids: sanitizeSelectedIds(next.selected_asset_ids, poolIds, lookup),
    }
    const saved = await updateStory(cleaned)
    setStories((current) => current.map((story) => (story.id === saved.id ? saved : story)))
  }

  async function handleEditedDerivative(source: IMediaAsset, derivative: IMediaAsset): Promise<void> {
    const nextAssets = [derivative, ...assets.filter((asset) => asset.id !== derivative.id)]
    const nextAssetsById = new Map(nextAssets.map((asset) => [asset.id, asset]))
    setAssets(nextAssets)
    if (!activeStory) {
      await refresh()
      return
    }
    const rootId = getRootId(source, nextAssetsById)
    const nextLists = adoptEditedDerivative(
      sanitizePoolIds(activeStory.pool_asset_ids, nextAssetsById),
      activeStory.selected_asset_ids,
      rootId,
      derivative.id,
      (assetId) => {
        const asset = nextAssetsById.get(assetId)
        if (!asset) throw new Error(`Asset ${assetId} was not found`)
        return getRootId(asset, nextAssetsById)
      },
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
    setVersionPickerAsset(null)
    try {
      const versions = await listAssetVersions(asset.id)
      if (versions.items.length <= 1) {
        openStudio(asset)
        return
      }
      setVersionPickerAsset(asset)
    } catch (error) {
      // Orphaned edits (missing original) still open directly in the studio.
      setMessage(error instanceof Error ? error.message : 'Unable to load versions — opening editor')
      openStudio(asset)
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
        <div className="mb-4 rounded-2xl border border-red-200 bg-brand-soft px-4 py-3 text-sm text-red-800">
          {message}
        </div>
      )}

      <div className="space-y-6">
        <StoryPicker
          stories={stories}
          activeStoryId={activeStoryId}
          onSelect={setActiveStoryId}
          onCreated={(story) => {
            setStories((current) => [story, ...current])
            setActiveStoryId(story.id)
          }}
          onError={setMessage}
        />

        {activeStory ? (
          <>
            <AssetInspector asset={selected} onUpdated={refresh} onError={setMessage} />
            <StoryWorkspace
              story={activeStory}
              assets={assets}
              assetsById={assetsById}
              selectedAssetId={selected?.id ?? null}
              onSelectAsset={setSelected}
              onEditImage={(asset) => {
                setSelected(asset)
                void openMediaEditor(asset)
              }}
              onEditVideo={(asset) => {
                setSelected(asset)
                void openMediaEditor(asset)
              }}
              removingBackground={removingBackground}
              onRemoveBackground={(asset) => {
                void (async () => {
                  setRemovingBackground(true)
                  setMessage('Removing background… this can take a few seconds')
                  try {
                    setSelected(asset)
                    const derivative = await removeBackground(asset.id)
                    await handleEditedDerivative(asset, derivative)
                    setMessage('Background removed — new version saved')
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
                      `Permanently delete "${label}" from originals? Edits of this picture are removed too. This cannot be undone.`,
                    )
                  ) {
                    return
                  }
                  try {
                    const deletedRootId = getRootId(asset, assetsById)
                    await deleteAsset(asset.id)
                    if (selected && getRootId(selected, assetsById) === deletedRootId) {
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
                    if (asset.version_of) return
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
            <ReadyControls story={activeStory} onPersist={persistStory} onError={setMessage} />
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

      {versionPickerAsset && (
        <VersionPicker
          asset={versionPickerAsset}
          onClose={() => setVersionPickerAsset(null)}
          onError={setMessage}
          onChoose={(version) => {
            setVersionPickerAsset(null)
            openStudio(version)
          }}
          onDelete={async (version) => {
            if (!version.version_of) {
              throw new Error('Re-edit cannot delete the original')
            }
            await deleteAsset(version.id)
            if (selected?.id === version.id) setSelected(null)
            await refresh()
            setMessage('Edit version deleted')
          }}
        />
      )}

      {imageEditorAsset && (
        <ImageEditor
          asset={imageEditorAsset}
          onClose={() => setImageEditorAsset(null)}
          onSaved={async (derivative) => {
            await handleEditedDerivative(imageEditorAsset, derivative)
          }}
        />
      )}

      {videoEditorAsset && (
        <VideoEditor
          asset={videoEditorAsset}
          onClose={() => setVideoEditorAsset(null)}
          onSaved={async (derivative) => {
            await handleEditedDerivative(videoEditorAsset, derivative)
            setMessage('Shorter video rendered and added to the report')
          }}
        />
      )}
    </main>
  )
}

interface ILoginScreenProps {
  onSuccess: () => void
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
  onPersist: (story: IMediaStory) => Promise<void>
  onError: (message: string) => void
}

/** Mark the ordered report selection ready for later NewsCore handoff. */
function ReadyControls({ story, onPersist, onError }: IReadyControlsProps): JSX.Element {
  async function markReady(): Promise<void> {
    try {
      await onPersist({ ...story, status: 'ready' })
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to mark story ready')
    }
  }

  return (
    <section className="me-panel flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
      <div>
        <p className="me-label mb-0">Handoff</p>
        <h2 className="font-serif text-2xl text-brand-ink">Report package status</h2>
        <p className="mt-1 text-sm text-slate-500">
          {story.selected_asset_ids.length} picture(s) ordered for the report · currently {story.status}
        </p>
      </div>
      <button
        className="me-btn-primary"
        disabled={story.selected_asset_ids.length === 0 || story.status === 'ready'}
        onClick={() => void markReady()}
      >
        {story.status === 'ready' ? 'Ready for editors' : 'Mark report ready'}
      </button>
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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('<p></p>')
  const [saving, setSaving] = useState(false)
  const editorEnabled = Boolean(asset)

  useEffect(() => {
    setTitle(asset?.title ?? '')
    setDescription(toDescriptionHtml(asset?.description))
  }, [asset])

  async function saveEdition(): Promise<void> {
    if (!asset) {
      onError('Select a picture first to edit its headline and description')
      return
    }
    const validationError = validateMediaMetadata(title, description)
    if (validationError) {
      onError(validationError)
      return
    }
    setSaving(true)
    try {
      await updateAsset(asset.id, { title: title.trim(), description })
      await onUpdated()
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
        </div>
        <button className="me-btn-primary" disabled={!editorEnabled || saving} onClick={() => void saveEdition()}>
          {saving ? 'Saving edition…' : 'Save edition'}
        </button>
      </div>

      <div className={`space-y-5 px-5 py-5 md:px-6 ${editorEnabled ? '' : 'pointer-events-none opacity-60'}`}>
        <div className="min-w-0">
          <span className="block text-sm font-medium text-slate-700">Headline</span>
          <DocumentTitleField
            value={title}
            onChange={setTitle}
            placeholder="Write a headline…"
            ariaLabel="Headline"
            maxLength={MAX_TITLE_LENGTH}
            formatCount={(count, max) => `${count}/${max}`}
          />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-medium text-slate-700">Description</span>
          <RichTextEditor
            key={asset?.id ?? 'no-asset'}
            value={description}
            onChange={setDescription}
            labels={RICH_TEXT_LABELS}
            ariaLabel="Description"
          />
        </div>
      </div>
    </section>
  )
}
