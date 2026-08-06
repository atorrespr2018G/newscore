'use client'

import dynamic from 'next/dynamic'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { VideoEditor } from '@/components/video-editor'
import {
  clearAccessToken, createCollection, deleteAsset, getAccessToken, IMediaAsset, IMediaCollection,
  listAssets, listCollections, login, removeBackground, renderVideo, updateAsset, updateCollection, uploadAsset,
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

  useEffect(() => setAuthenticated(Boolean(getAccessToken())), [])
  useEffect(() => { if (authenticated) void refresh() }, [authenticated])

  async function refresh(): Promise<void> {
    try {
      const [newAssets, newCollections] = await Promise.all([listAssets(), listCollections()])
      setAssets(newAssets)
      setCollections(newCollections)
      setSelected((current) => newAssets.find((asset) => asset.id === current?.id) ?? null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load media library')
    }
  }

  if (!authenticated) return <LoginScreen onSuccess={() => setAuthenticated(true)} />

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex items-center justify-between border-b pb-4">
        <div><p className="text-sm font-semibold text-red-700">NEWSCORE</p><h1 className="text-3xl font-bold">Media editor</h1></div>
        <button className="rounded border px-3 py-2" onClick={() => { clearAccessToken(); setAuthenticated(false) }}>Sign out</button>
      </header>
      {message && <p className="mb-4 rounded bg-red-50 p-3 text-red-800">{message}</p>}
      <UploadControl onUploaded={(asset) => { setAssets((current) => [asset, ...current]); setSelected(asset) }} onError={setMessage} />
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <AssetGrid assets={assets} selected={selected} onSelect={setSelected} />
        <AssetInspector asset={selected} onUpdated={refresh} onError={setMessage} onImageEdit={setEditorAsset} />
      </section>
      <CollectionManager assets={assets} collections={collections} onChanged={refresh} onError={setMessage} />
      {editorAsset && <ImageEditor asset={editorAsset} onClose={() => setEditorAsset(null)} onSaved={refresh} />}
    </main>
  )
}

interface ILoginScreenProps { onSuccess: () => void }

/** Authenticate the independent application against NewsCore's auth API. */
function LoginScreen({ onSuccess }: ILoginScreenProps): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    try { await login(email, password); onSuccess() } catch (exception) { setError(exception instanceof Error ? exception.message : 'Sign-in failed') }
  }

  return <main className="mx-auto max-w-md p-10"><h1 className="text-3xl font-bold">Media editor sign in</h1><form className="mt-6 space-y-3" onSubmit={submit}>
    <input aria-label="Email" className="w-full border p-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
    <input aria-label="Password" className="w-full border p-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
    {error && <p className="text-red-700">{error}</p>}<button className="w-full rounded bg-slate-900 p-2 text-white" type="submit">Sign in</button>
  </form></main>
}

interface IUploadControlProps { onUploaded: (asset: IMediaAsset) => void; onError: (message: string) => void }

/** Upload a supported image or video directly into the independent service. */
function UploadControl({ onUploaded, onError }: IUploadControlProps): JSX.Element {
  async function change(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return
    try { onUploaded(await uploadAsset(file)) } catch (exception) { onError(exception instanceof Error ? exception.message : 'Upload failed') }
  }
  return <label className="block cursor-pointer rounded border-2 border-dashed p-6 text-center font-medium">Upload image or video<input className="sr-only" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" type="file" onChange={change} /></label>
}

interface IAssetGridProps { assets: IMediaAsset[]; selected: IMediaAsset | null; onSelect: (asset: IMediaAsset) => void }

/** Display uploaded assets in a selectable visual library. */
function AssetGrid({ assets, selected, onSelect }: IAssetGridProps): JSX.Element {
  return <section><h2 className="mb-3 text-xl font-bold">Library</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-3">
    {assets.map((asset) => <button className={`overflow-hidden rounded border text-left ${asset.id === selected?.id ? 'ring-2 ring-red-700' : ''}`} key={asset.id} onClick={() => onSelect(asset)}>
      {asset.file_type === 'image' ? <img alt={asset.alt_text ?? asset.original_filename} className="h-32 w-full object-cover" src={asset.preview_url ?? asset.url} /> : <video className="h-32 w-full object-cover" src={asset.url} />}
      <span className="block truncate p-2 text-sm">{asset.title ?? asset.original_filename}</span>
    </button>)}
  </div></section>
}

interface IAssetInspectorProps { asset: IMediaAsset | null; onUpdated: () => Promise<void>; onError: (message: string) => void; onImageEdit: (asset: IMediaAsset) => void }

/** Edit selected asset metadata and open its applicable editing controls. */
function AssetInspector({ asset, onUpdated, onError, onImageEdit }: IAssetInspectorProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  useEffect(() => {
    setTitle(asset?.title ?? '')
    setDescription(asset?.description ?? '')
  }, [asset])
  if (!asset) return <aside className="rounded border p-4">Select an asset to edit its metadata.</aside>
  async function save(): Promise<void> { try { await updateAsset(asset.id, { title, description }); await onUpdated() } catch (error) { onError(error instanceof Error ? error.message : 'Save failed') } }
  async function removeBg(): Promise<void> { try { await removeBackground(asset.id); await onUpdated() } catch (error) { onError(error instanceof Error ? error.message : 'Background removal failed') } }
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
    <aside className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-bold">Asset details</h2>
      {asset.version_of && <p className="text-xs text-neutral-600">Edited version of {asset.version_of}</p>}
      <input aria-label="Title" className="w-full border p-2" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea aria-label="News description" className="w-full border p-2" value={description} onChange={(event) => setDescription(event.target.value)} />
      <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => void save()}>Save metadata</button>
      {asset.file_type === 'image' ? (
        <>
          <button className="ml-2 rounded border px-3 py-2" onClick={() => onImageEdit(asset)}>Edit image</button>
          <button className="ml-2 rounded border px-3 py-2" onClick={() => void removeBg()}>Remove background</button>
        </>
      ) : (
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
      <button className="block rounded border border-red-700 px-3 py-2 text-red-700" onClick={() => void removeAsset()}>
        Delete {asset.version_of ? 'edited picture' : 'asset'}
      </button>
    </aside>
  )
}

interface ICollectionManagerProps { assets: IMediaAsset[]; collections: IMediaCollection[]; onChanged: () => Promise<void>; onError: (message: string) => void }

/** Create and mark ready an ordered collection for the future NewsCore handoff. */
function CollectionManager({ assets, collections, onChanged, onError }: ICollectionManagerProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [assetIds, setAssetIds] = useState<string[]>([])
  async function create(): Promise<void> { try { const collection = await createCollection(title); await updateCollection(collection, assetIds, 'ready'); setTitle(''); setAssetIds([]); await onChanged() } catch (error) { onError(error instanceof Error ? error.message : 'Collection save failed') } }
  function toggle(id: string): void { setAssetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  return <section className="mt-8 rounded border p-4"><h2 className="text-xl font-bold">Ready collections</h2><div className="mt-3 flex gap-2"><input className="border p-2" placeholder="Collection title" value={title} onChange={(event) => setTitle(event.target.value)} /><button className="rounded bg-red-700 px-3 py-2 text-white" disabled={!title} onClick={() => void create()}>Mark selected assets ready</button></div><div className="mt-3 flex flex-wrap gap-3">{assets.map((asset) => <label key={asset.id}><input checked={assetIds.includes(asset.id)} type="checkbox" onChange={() => toggle(asset.id)} /> {asset.title ?? asset.original_filename}</label>)}</div><ul className="mt-4 list-disc pl-6">{collections.map((collection) => <li key={collection.id}>{collection.title} — {collection.status} ({collection.asset_ids.length} assets)</li>)}</ul></section>
}
