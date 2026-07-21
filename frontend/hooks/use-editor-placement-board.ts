'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { apiConfig } from '@/lib/api/config'
import { apiFetch } from '@/lib/api/rest-client'
import { useEditorScope } from '@/context/editor-scope-context'
import { REPORTER_UPLOAD_STATUS } from '@/lib/helpers/editor-curation'
import { notifyEditorialPreviewStale, subscribeToEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import {
  buildPlacementTargets,
  type IPlacementTarget,
} from '@/lib/helpers/editor-placement-targets'
import { layoutHasUnpublishedPlacementChanges } from '@/lib/helpers/slot-editor-pinned-ids'
import { useEditorPreviewFeed } from '@/hooks/use-editor-preview-feed'
import { useEditorStatus } from '@/hooks/use-editor-status'
import { useEditorCategories } from '@/hooks/use-editor-categories'
import { useHomepagePlacementEditor } from '@/hooks/use-homepage-placement-editor'
import type {
  AdminTranslatorType,
  IArticleDetail,
  IEditorPlacementBoard,
  IEditorStatus,
} from '@/interfaces/editor-article'
import type { IEditorScope } from '@/lib/editor/editor-scope'

interface IDroppedArticleDetail {
  title: string
  status: string
}

interface IPublishDroppedArticleOptions {
  articleId: string
  scope: IEditorScope
  status: Pick<IEditorStatus, 'setError' | 'setMessage' | 'setSaving'>
  t: AdminTranslatorType
}

/**
 * Fetch a dropped story's title and status for the placement board.
 *
 * The News card carries only the article id, so the board resolves the title
 * (for staged-placement banners) and status (to auto-publish reporter drafts)
 * with a single detail fetch. A failed lookup is non-fatal: the placement still
 * proceeds and the banner falls back to the article id.
 *
 * @param articleId Article dragged from the News page.
 * @returns Title/status, or null when the lookup fails.
 */
async function fetchDroppedArticleDetail(articleId: string): Promise<IDroppedArticleDetail | null> {
  try {
    const detail = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
    return { title: detail.title, status: detail.status }
  } catch {
    return null
  }
}

/**
 * Publish a freshly placed reporter draft so it can reach the live page.
 *
 * @param options Article id, active scope, status setters, and the translator.
 * @returns Resolves once the publish request settles.
 */
async function publishDroppedArticle(options: IPublishDroppedArticleOptions): Promise<void> {
  const { articleId, scope, status, t } = options
  status.setSaving(true)
  status.setError(null)
  try {
    await apiFetch(`${apiConfig.news}/articles/${articleId}/publish`, { method: 'POST' })
    status.setMessage(t('editor.status.placedAndPublished'))
    notifyEditorialPreviewStale(scope)
  } catch (err) {
    status.setError(err instanceof Error ? err.message : t('editor.errors.publishPlaced'))
  } finally {
    status.setSaving(false)
  }
}

/**
 * Orchestrate the Placement page: homepage canvas, live preview, and publishing.
 *
 * Stories arrive by native drag-and-drop from the News page (id only), so the
 * dropped article's detail is fetched once to resolve its title (for banners)
 * and status (to auto-publish freshly placed reporter drafts). Titles are kept
 * in a ref-backed map so the placement mutation callbacks stay stable.
 *
 * @returns State and actions consumed by the Placement page UI.
 */
export function useEditorPlacementBoard(): IEditorPlacementBoard {
  const t = useTranslations('admin')
  const scope = useEditorScope()
  const status = useEditorStatus()
  const categories = useEditorCategories(status)
  const articleTitleByIdRef = useRef<Map<string, string>>(new Map())
  const placement = useHomepagePlacementEditor(status, scope, articleTitleByIdRef.current, categories)
  const preview = useEditorPreviewFeed(scope, true)

  // Prefer preview slots (always fetched for the active scope) unless local
  // placement state already has slots for this scope. Avoids US slot ids paired
  // with a PR feed, which disables every Politics drop target.
  const homepageSlots =
    placement.homepageSlots.length > 0 &&
    preview.homepageSlots.length > 0 &&
    placement.homepageSlots.some((slot) =>
      preview.homepageSlots.some((previewSlot) => previewSlot.id === slot.id),
    )
      ? placement.homepageSlots
      : preview.homepageSlots.length > 0
        ? preview.homepageSlots
        : placement.homepageSlots
  const placementTargets = buildPlacementTargets(homepageSlots)

  // Keep mutation refs in sync with the slots the canvas is actually using.
  // Otherwise a PR Politics drop target can appear while homepageSlotsRef still
  // holds US (or empty) slots and the pin mutation no-ops / fails.
  useEffect(() => {
    const placementAligned =
      placement.homepageSlots.length > 0 &&
      homepageSlots.length > 0 &&
      placement.homepageSlots.some((slot) => homepageSlots.some((next) => next.id === slot.id))
    if (!placementAligned && homepageSlots.length > 0) {
      placement.replaceHomepageSlots(homepageSlots)
    }
  }, [homepageSlots, placement.homepageSlots, placement.replaceHomepageSlots])

  // Pull a fresh feed whenever any window marks the homepage stale so the
  // WYSIWYG placement canvas stays current.
  const refreshRef = useRef(preview.refresh)
  refreshRef.current = preview.refresh
  const loadSlotsRef = useRef(placement.loadHomepageSlots)
  loadSlotsRef.current = placement.loadHomepageSlots
  useEffect(() => {
    return subscribeToEditorialPreviewStale(() => {
      void refreshRef.current()
      void loadSlotsRef.current()
    })
  }, [])

  const { setLoading, setError, setMessage, setSaving } = status

  const applyDropPlacement = useCallback(
    async (articleId: string, target: IPlacementTarget): Promise<boolean> => {
      const dropped = await fetchDroppedArticleDetail(articleId)
      if (!dropped) {
        setError(t('editor.errors.invalidDropPayload'))
        return false
      }
      articleTitleByIdRef.current.set(articleId, dropped.title)
      const placed = await placement.applyDropPlacement(articleId, target)
      if (placed) {
        await preview.refresh()
      }
      if (placed && dropped.status === REPORTER_UPLOAD_STATUS) {
        await publishDroppedArticle({
          articleId,
          scope,
          status: { setError, setMessage, setSaving },
          t,
        })
      }
      return placed
    },
    [placement.applyDropPlacement, preview.refresh, scope, setError, setMessage, setSaving, t],
  )

  useEffect(() => {
    setLoading(true)
    void Promise.all([placement.loadHomepageSlots(), placement.loadArticlePlacements()])
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('editor.errors.loadEditorData'))
      })
      .finally(() => setLoading(false))
  }, [placement.loadHomepageSlots, placement.loadArticlePlacements, setLoading, setError, t])

  return {
    loading: status.loading,
    error: status.error,
    message: status.message,
    saving: status.saving,
    homepageSlots,
    placementTargets,
    hasUnpublishedPlacements: layoutHasUnpublishedPlacementChanges(homepageSlots),
    applyDropPlacement,
    applyRemovePlacement: placement.applyRemovePlacement,
    applyMovePlacement: placement.applyMovePlacement,
    publishHomepageChanges: placement.publishHomepageChanges,
    previewFeed: preview.previewFeed,
    previewLoading: preview.loading,
    previewError: preview.error,
    refreshing: preview.refreshing,
    refreshPreview: preview.refresh,
  }
}
