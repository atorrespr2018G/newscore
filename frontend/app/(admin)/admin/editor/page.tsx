'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import { EditorStoryPool } from '@/components/features/editor-story-pool'
import { HomepagePlacementCanvas } from '@/components/features/homepage-placement-canvas'
import { useEditorCuration, type IEditorCuration } from '@/hooks/use-editor-curation'

const EDITOR_WORKSPACE_HEIGHT_CLASS = 'lg:max-h-[calc(100dvh-14rem)]'
const EDITOR_CANVAS_STICKY_CLASS = 'lg:sticky lg:top-24 lg:self-start'

export default function EditorCurationPage(): JSX.Element {
  const editor = useEditorCuration()
  const t = useTranslations('admin')

  return (
    <div>
      <EditorHeader />

      {editor.hasUnpublishedPlacements ? (
        <EditorPlacementBanner saving={editor.saving} onPublish={editor.publishHomepageChanges} />
      ) : null}

      <EditorStatusMessages error={editor.error} message={editor.message} />

      {editor.loading ? (
        <p className="mt-8 text-neutral-600">{t('editor.loading')}</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <EditorStoryPoolSection editor={editor} />
          <EditorWorkspaceColumn editor={editor} />
        </div>
      )}
    </div>
  )
}

function EditorHeader(): JSX.Element {
  const t = useTranslations('admin')

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-2xl font-bold">{t('editor.heading')}</h1>
        <Link href="/admin/preview" className="text-sm font-semibold text-brand hover:underline">
          {t('editor.previewLink')}
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">{t('editor.subtitle')}</p>
    </>
  )
}

interface IEditorPlacementBannerProps {
  saving: boolean
  onPublish: () => void
}

function EditorPlacementBanner({ saving, onPublish }: IEditorPlacementBannerProps): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-900">{t('editor.banner.unpublished')}</p>
      <button
        type="button"
        disabled={saving}
        onClick={() => void onPublish()}
        className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {t('editor.banner.publish')}
      </button>
    </div>
  )
}

interface IEditorStatusMessagesProps {
  error: string | null
  message: string | null
}

function EditorStatusMessages({ error, message }: IEditorStatusMessagesProps): JSX.Element {
  return (
    <>
      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
          {message}
        </p>
      ) : null}
    </>
  )
}

function EditorStoryPoolSection({ editor }: { editor: IEditorCuration }): JSX.Element {
  const t = useTranslations('admin')

  return (
    <section className="min-w-0 rounded-lg border border-neutral-200 bg-white">
      <EditorArticleIdLoader
        articleIdInput={editor.articleIdInput}
        setArticleIdInput={editor.setArticleIdInput}
        onLoad={editor.loadArticleByIdInput}
      />
      <div className="p-4">
        <EditorStoryPool
          articles={editor.articles}
          selectedId={editor.selectedId}
          placementMap={editor.placementMap}
          onSearch={editor.searchArticles}
          onSelect={(articleId: string) => void editor.loadArticleDetail(articleId)}
          categories={editor.categories}
          selectedCategoryIds={editor.selectedCategoryIds}
          setSelectedCategoryIds={editor.setSelectedCategoryIds}
          internationalPotential={editor.internationalPotential}
          setInternationalPotential={editor.setInternationalPotential}
          detail={editor.detail}
          maxImageCount={editor.maxImageCount}
          setMaxImageCount={editor.setMaxImageCount}
          mediaItems={editor.mediaItems}
          setMediaItems={editor.setMediaItems}
          saving={editor.saving}
          onSave={() => void editor.saveArticleChanges()}
          onPublish={() => void editor.publishSelected()}
        />
        {editor.articles.length === 0 ? (
          <p className="py-8 text-center text-neutral-500">{t('editor.emptyPool')}</p>
        ) : null}
      </div>
    </section>
  )
}

interface IEditorArticleIdLoaderProps {
  articleIdInput: string
  setArticleIdInput: Dispatch<SetStateAction<string>>
  onLoad: () => void
}

function EditorArticleIdLoader({
  articleIdInput,
  setArticleIdInput,
  onLoad,
}: IEditorArticleIdLoaderProps): JSX.Element {
  const t = useTranslations('admin')

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
      <label className="min-w-[16rem] flex-1 text-sm font-medium text-neutral-700">
        {t('editor.loadById.label')}
        <input
          type="text"
          value={articleIdInput}
          onChange={(event) => setArticleIdInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onLoad()
            }
          }}
          placeholder={t('editor.loadById.placeholder')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs"
        />
      </label>
      <button
        type="button"
        onClick={onLoad}
        className="rounded border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5"
      >
        {t('editor.loadById.load')}
      </button>
    </div>
  )
}

function EditorWorkspaceColumn({ editor }: { editor: IEditorCuration }): JSX.Element {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${EDITOR_WORKSPACE_HEIGHT_CLASS} ${EDITOR_CANVAS_STICKY_CLASS}`}
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <HomepagePlacementCanvas
          slots={editor.homepageSlots}
          targets={editor.placementTargets}
          articleById={editor.articleById}
          selectedArticleId={editor.selectedId}
          saving={editor.saving}
          onDropPlacement={(articleId, target) => void editor.applyDropPlacement(articleId, target)}
          onRemovePlacement={(target) => void editor.applyRemovePlacement(target)}
          onMovePlacement={(target, direction) => void editor.applyMovePlacement(target, direction)}
        />
      </div>
    </div>
  )
}
