'use client'

import dynamic from 'next/dynamic'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { VideoEditor } from '@/components/video-editor'
import {
  clearAccessToken,
  createCollection,
  deleteAsset,
  getAccessToken,
  IMediaAsset,
  IMediaCollection,
  listAssets,
  listCollections,
  login,
  removeBackground,
  renderVideo,
  updateAsset,
  updateCollection,
  uploadAsset,
} from '@/lib/media-editor-client'

const ImageEditor = dynamic(
  () => import('@/components/image-editor').then((module) => module.ImageEditor),
  { ssr: false },
)

/** Render the independent reporter media-library workspace. */
export default function MediaLibraryPage(): JSX.Element {
  const [assets, setAssets] = useState<IMediaAsset[]>([])
  const [collections, setCollections] = useState<IMediaCollection[]>([])
  const [selected, setSelected] = useState<IMediaAsset | null>(null)
  const [editorAsset, setEditorAsset] = useState<IMediaAsset | null>(null)
  const [message, setMessage] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => setAuthenticated(Boolean(getAccessToken())), [])
  useEffect(() => {
    if (authenticated) void refresh()
  }, [authenticated])

  async function refresh(): Promise<void> {
    setBusy(true)
    try {
      const [newAssets, newCollections] = await Promise.all([listAssets(), listCollections()])
      setAssets(newAssets)
      setCollections(newCollections)
      setSelected((current) => newAssets.find((asset) => asset.id === current?.id) ?? null)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load media library')
    } finally {
      setBusy(false)
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
            <p className="mt-1 text-sm text-slate-500">Prepare pictures and video for editorial handoff</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-xl border border-brand-line bg-brand-paper px-3 py-2 text-xs text-slate-600 sm:block">
            {assets.length} assets · {collections.length} collections
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6">
          <UploadControl
            onUploaded={(asset) => {
              setAssets((current) => [asset, ...current])
              setSelected(asset)
            }}
            onError={setMessage}
          />
          <AssetGrid assets={assets} selected={selected} busy={busy} onSelect={setSelected} />
          <CollectionManager assets={assets} collections={collections} onChanged={refresh} onError={setMessage} />
        </section>
        <AssetInspector asset={selected} onUpdated={refresh} onError={setMessage} onImageEdit={setEditorAsset} />
      </div>

      {editorAsset && <ImageEditor asset={editorAsset} onClose={() => setEditorAsset(null)} onSaved={refresh} />}
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

interface IUploadControlProps {
  onUploaded: (asset: IMediaAsset) => void
  onError: (message: string) => void
}

/** Upload a supported image or video directly into the independent service. */
function UploadControl({ onUploaded, onError }: IUploadControlProps): JSX.Element {
  const [uploading, setUploading] = useState(false)

  async function change(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      onUploaded(await uploadAsset(file))
    } catch (exception) {
      onError(exception instanceof Error ? exception.message : 'Upload failed')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <label className="me-panel group flex cursor-pointer flex-col items-center justify-center border-dashed px-6 py-10 text-center transition hover:border-brand/40 hover:bg-brand-soft/40">
      <span className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-mist text-lg font-semibold text-brand-ink transition group-hover:bg-white">
        +
      </span>
      <span className="font-serif text-2xl text-brand-ink">
        {uploading ? 'Uploading…' : 'Drop media into the desk'}
      </span>
      <span className="mt-2 max-w-md text-sm text-slate-500">
        JPEG, PNG, WebP, MP4, WebM, or QuickTime. Files are stored in the independent media service.
      </span>
      <input
        className="sr-only"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        type="file"
        disabled={uploading}
        onChange={change}
      />
    </label>
  )
}

interface IAssetGridProps {
  assets: IMediaAsset[]
  selected: IMediaAsset | null
  busy: boolean
  onSelect: (asset: IMediaAsset) => void
}

/** Display uploaded assets in a selectable visual library. */
function AssetGrid({ assets, selected, busy, onSelect }: IAssetGridProps): JSX.Element {
  return (
    <section className="me-panel p-5 md:p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="me-label mb-0">Library</p>
          <h2 className="font-serif text-3xl text-brand-ink">Picture & video pool</h2>
        </div>
        {busy && <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Refreshing</span>}
      </div>
      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-line bg-brand-paper px-6 py-16 text-center">
          <p className="font-serif text-2xl text-brand-ink">No media yet</p>
          <p className="mt-2 text-sm text-slate-500">Upload an image or video to begin editing and ordering.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {assets.map((asset) => {
            const active = asset.id === selected?.id
            return (
              <button
                key={asset.id}
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  active
                    ? 'border-brand shadow-lift ring-2 ring-brand/20'
                    : 'border-brand-line hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-panel'
                }`}
                onClick={() => onSelect(asset)}
              >
                <div className="relative aspect-[4/3] bg-brand-mist">
                  {asset.file_type === 'image' ? (
                    <img
                      alt={asset.alt_text ?? asset.original_filename}
                      className="h-full w-full object-cover"
                      src={asset.preview_url ?? asset.url}
                    />
                  ) : (
                    <video className="h-full w-full object-cover" src={asset.url} muted />
                  )}
                  <span className="absolute left-3 top-3 rounded-lg bg-brand-ink/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    {asset.version_of ? 'Edited' : asset.file_type}
                  </span>
                </div>
                <div className="space-y-1 px-3 py-3">
                  <p className="truncate text-sm font-semibold text-brand-ink">
                    {asset.title ?? asset.original_filename}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {asset.width && asset.height ? `${asset.width}×${asset.height}` : 'Ready'}
                    {asset.version_of ? ' · derivative' : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

interface IAssetInspectorProps {
  asset: IMediaAsset | null
  onUpdated: () => Promise<void>
  onError: (message: string) => void
  onImageEdit: (asset: IMediaAsset) => void
}

/** Edit selected asset metadata and open its applicable editing controls. */
function AssetInspector({ asset, onUpdated, onError, onImageEdit }: IAssetInspectorProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    setTitle(asset?.title ?? '')
    setDescription(asset?.description ?? '')
  }, [asset])

  if (!asset) {
    return (
      <aside className="me-panel sticky top-6 h-fit p-6">
        <p className="me-label">Inspector</p>
        <h2 className="font-serif text-3xl text-brand-ink">Select a frame</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Choose an asset from the library to edit metadata, crop and annotate pictures, or trim video.
        </p>
      </aside>
    )
  }

  async function save(): Promise<void> {
    try {
      await updateAsset(asset.id, { title, description })
      await onUpdated()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Save failed')
    }
  }

  async function removeBg(): Promise<void> {
    try {
      await removeBackground(asset.id)
      await onUpdated()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Background removal failed')
    }
  }

  async function removeAsset(): Promise<void> {
    if (!window.confirm(`Delete "${asset.title ?? asset.original_filename}"? This cannot be undone.`)) return
    try {
      await deleteAsset(asset.id)
      await onUpdated()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  return (
    <aside className="me-panel sticky top-6 h-fit space-y-5 p-6">
      <div>
        <p className="me-label">Inspector</p>
        <h2 className="font-serif text-3xl text-brand-ink">Asset details</h2>
        {asset.version_of && (
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-brand">Edited derivative</p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-mist">
        {asset.file_type === 'image' ? (
          <img
            alt={asset.alt_text ?? asset.original_filename}
            className="max-h-56 w-full object-cover"
            src={asset.preview_url ?? asset.url}
          />
        ) : (
          <video className="max-h-56 w-full object-cover" controls src={asset.url} />
        )}
      </div>

      <div>
        <label className="me-label" htmlFor="asset-title">Title</label>
        <input id="asset-title" className="me-input" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div>
        <label className="me-label" htmlFor="asset-description">News description</label>
        <textarea
          id="asset-description"
          className="me-input min-h-[110px] resize-y"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="me-btn-primary" onClick={() => void save()}>Save metadata</button>
        {asset.file_type === 'image' && (
          <>
            <button className="me-btn-secondary" onClick={() => onImageEdit(asset)}>Edit image</button>
            <button className="me-btn-secondary" onClick={() => void removeBg()}>Remove background</button>
          </>
        )}
      </div>

      {asset.file_type === 'video' && (
        <VideoEditor
          asset={asset}
          onRender={async (instruction) => {
            try {
              await renderVideo(asset.id, instruction)
              await onUpdated()
            } catch (error) {
              onError(error instanceof Error ? error.message : 'Video render failed')
            }
          }}
        />
      )}

      <button className="me-btn-danger w-full" onClick={() => void removeAsset()}>
        Delete {asset.version_of ? 'edited picture' : 'asset'}
      </button>
    </aside>
  )
}

interface ICollectionManagerProps {
  assets: IMediaAsset[]
  collections: IMediaCollection[]
  onChanged: () => Promise<void>
  onError: (message: string) => void
}

/** Create and mark ready an ordered collection for the future NewsCore handoff. */
function CollectionManager({ assets, collections, onChanged, onError }: ICollectionManagerProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [assetIds, setAssetIds] = useState<string[]>([])

  async function create(): Promise<void> {
    try {
      const collection = await createCollection(title)
      await updateCollection(collection, assetIds, 'ready')
      setTitle('')
      setAssetIds([])
      await onChanged()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Collection save failed')
    }
  }

  function toggle(id: string): void {
    setAssetIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <section className="me-panel p-5 md:p-6">
      <div className="mb-5">
        <p className="me-label mb-0">Handoff</p>
        <h2 className="font-serif text-3xl text-brand-ink">Ready collections</h2>
        <p className="mt-2 text-sm text-slate-500">
          Order selected assets and mark the package ready for a later NewsCore editor import.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="me-input md:flex-1"
          placeholder="Collection title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="me-btn-primary whitespace-nowrap" disabled={!title || assetIds.length === 0} onClick={() => void create()}>
          Mark selected ready
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {assets.map((asset) => {
          const checked = assetIds.includes(asset.id)
          return (
            <label
              key={asset.id}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-sm transition ${
                checked ? 'border-brand bg-brand-soft text-brand' : 'border-brand-line bg-white text-slate-600'
              }`}
            >
              <input className="sr-only" checked={checked} type="checkbox" onChange={() => toggle(asset.id)} />
              {asset.title ?? asset.original_filename}
            </label>
          )
        })}
      </div>

      <ul className="mt-6 space-y-2">
        {collections.length === 0 ? (
          <li className="rounded-xl bg-brand-paper px-4 py-3 text-sm text-slate-500">No ready collections yet.</li>
        ) : (
          collections.map((collection) => (
            <li
              key={collection.id}
              className="flex items-center justify-between rounded-xl border border-brand-line bg-white px-4 py-3 text-sm"
            >
              <span className="font-semibold text-brand-ink">{collection.title}</span>
              <span className="text-slate-500">
                {collection.status} · {collection.asset_ids.length} assets
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
