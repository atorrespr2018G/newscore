'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  getHomepageLayout,
  getLayoutSlots,
  type ISlotOut,
  publishHomepagePlacements,
} from '@/lib/api/layout-client'
import type { ICategoryOut } from '@/lib/api/category-client'
import {
  appendCategoryCascadeUpdates,
  buildPlacementMutation,
  buildRemovePlacementMutation,
  buildReorderPlacementMutation,
  type IPlacementMutationResult,
  type PlacementMoveDirectionType,
} from '@/lib/helpers/editor-placement'
import { buildPlacementTargets, type IPlacementTarget } from '@/lib/helpers/editor-placement-targets'
import { isHeroOrTopStoriesPositionKey } from '@/lib/helpers/feed-layout'
import { layoutHasUnpublishedPlacementChanges } from '@/lib/helpers/slot-editor-pinned-ids'
import { notifyEditorialPreviewStale } from '@/lib/helpers/editorial-preview-events'
import {
  commitPlacementMutation,
  fetchArticleCategoryIds,
  formatMoveMessage,
  formatPlacementMessage,
  formatPublishResult,
  formatRemoveMessage,
  resolveCategoryCascadeSlotIds,
} from '@/lib/helpers/editor-placement-messages'
import { notifyWorkflowBadgesRefresh } from '@/lib/api/workflow-badges-client'
import type { IEditorScope } from '@/lib/editor/editor-scope'
import type { IEditorStatus, IHomepagePlacementEditor } from '@/interfaces/editor-article'
import { useArticlePlacements } from '@/hooks/use-article-placements'

type PlacementMutation = IPlacementMutationResult

/**
 * Manage homepage slot placements, staged moves, and publishing.
 *
 * @param status Shared status banners.
 * @param scope Active editor market/page scope.
 * @param articleTitleById Lookup of article titles for staged-move messages.
 * @param categories Available categories, used to cascade hero/top-stories pins.
 * @returns Homepage placement state and actions.
 */
export function useHomepagePlacementEditor(
  status: IEditorStatus,
  scope: IEditorScope,
  articleTitleById: Map<string, string>,
  categories: ICategoryOut[],
): IHomepagePlacementEditor {
  const t = useTranslations('admin')
  const { setError, setMessage, setSaving } = status
  const [homepageSlots, setHomepageSlots] = useState<ISlotOut[]>([])
  const homepageSlotsRef = useRef(homepageSlots)
  const { articlePlacements, placementMap, loadArticlePlacements } = useArticlePlacements(scope)

  const categorySlugById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      map.set(category.id, category.slug)
    }
    return map
  }, [categories])

  useEffect(() => {
    homepageSlotsRef.current = homepageSlots
  }, [homepageSlots])

  const loadHomepageSlots = useCallback(async () => {
    const layout = await getHomepageLayout(scope.marketCode, scope.pageName)
    if (!layout.id) {
      setHomepageSlots([])
      return
    }
    setHomepageSlots(await getLayoutSlots(layout.id))
  }, [scope.marketCode, scope.pageName])

  const placementTargets = useMemo(() => buildPlacementTargets(homepageSlots), [homepageSlots])
  const hasUnpublishedPlacements = useMemo(
    () => layoutHasUnpublishedPlacementChanges(homepageSlots),
    [homepageSlots],
  )

  const publishHomepageChanges = useCallback(async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await publishHomepagePlacements(scope)
      setMessage(formatPublishResult(t, result.published_slot_count))
      await Promise.all([loadHomepageSlots(), loadArticlePlacements()])
      notifyEditorialPreviewStale(scope)
      // Nudge the masthead Placement badge to recount now instead of waiting
      // for its poll interval, so the counter reflects this publish immediately.
      notifyWorkflowBadgesRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editor.errors.publishPlacements'))
    } finally {
      setSaving(false)
    }
  }, [loadHomepageSlots, loadArticlePlacements, scope, setError, setMessage, setSaving, t])

  /**
   * Commit a staged placement mutation with optimistic update and rollback.
   *
   * @param mutation Slot patch set to apply.
   * @param buildSuccessMessage Builds the banner text from the pre-mutation slots.
   * @returns Resolves once the mutation is committed or rolled back.
   */
  const runPlacementMutation = useCallback(
    async (
      mutation: PlacementMutation,
      buildSuccessMessage: (previousSlots: ISlotOut[]) => string,
    ): Promise<boolean> => {
      setSaving(true)
      setError(null)
      setMessage(null)
      const previousSlots = homepageSlotsRef.current
      try {
        const mergedSlots = await commitPlacementMutation(mutation, previousSlots, (slots) => {
          setHomepageSlots(slots)
          homepageSlotsRef.current = slots
        })
        setHomepageSlots(mergedSlots)
        homepageSlotsRef.current = mergedSlots
        await loadArticlePlacements()
        setMessage(buildSuccessMessage(previousSlots))
        notifyEditorialPreviewStale(scope)
        // A drop/move records a placement_event server-side; nudge the masthead
        // Placement badge to recount now rather than on its next poll.
        notifyWorkflowBadgesRefresh()
        return true
      } catch (err) {
        setHomepageSlots(previousSlots)
        homepageSlotsRef.current = previousSlots
        setError(err instanceof Error ? err.message : t('editor.errors.placementFailed'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [loadArticlePlacements, scope, setError, setMessage, setSaving, t],
  )

  /**
   * Resolve the category sections a hero/top-stories drop should cascade into.
   *
   * @param articleId Story being placed.
   * @param target Drop target slot/index metadata.
   * @returns Category slot ids to also pin the story into (empty when N/A).
   */
  const resolveDropCascadeSlotIds = useCallback(
    async (articleId: string, target: IPlacementTarget): Promise<string[]> => {
      if (!isHeroOrTopStoriesPositionKey(target.positionKey)) {
        return []
      }
      const categoryIds = await fetchArticleCategoryIds(articleId)
      return resolveCategoryCascadeSlotIds({
        slots: homepageSlotsRef.current,
        categoryIds,
        categorySlugById,
        targetSlotId: target.slotId,
      })
    },
    [categorySlugById],
  )

  const applyDropPlacement = useCallback(
    async (articleId: string, target: IPlacementTarget): Promise<boolean> => {
      if (target.articleId === articleId) {
        return false
      }
      const cascadeSlotIds = await resolveDropCascadeSlotIds(articleId, target)
      const baseMutation = buildPlacementMutation(
        homepageSlotsRef.current,
        articleId,
        target.slotId,
        target.index,
        target.articleId,
      )
      const mutation = cascadeSlotIds.length
        ? appendCategoryCascadeUpdates(baseMutation, homepageSlotsRef.current, articleId, cascadeSlotIds)
        : baseMutation
      return runPlacementMutation(mutation, (previousSlots) =>
        formatPlacementMessage({
          t,
          mutation,
          previousSlots,
          articleId,
          articleTitleById,
          target,
          cascadeCount: cascadeSlotIds.length,
        }),
      )
    },
    [articleTitleById, resolveDropCascadeSlotIds, runPlacementMutation, t],
  )

  const applyRemovePlacement = useCallback(
    async (target: IPlacementTarget) => {
      const mutation = buildRemovePlacementMutation(
        homepageSlotsRef.current,
        target.slotId,
        target.index,
      )
      await runPlacementMutation(mutation, () => formatRemoveMessage(t, target, articleTitleById))
    },
    [articleTitleById, runPlacementMutation, t],
  )

  const applyMovePlacement = useCallback(
    async (target: IPlacementTarget, direction: PlacementMoveDirectionType) => {
      const mutation = buildReorderPlacementMutation(
        homepageSlotsRef.current,
        target.slotId,
        target.index,
        direction,
      )
      await runPlacementMutation(mutation, () =>
        formatMoveMessage(t, target, direction, articleTitleById),
      )
    },
    [articleTitleById, runPlacementMutation, t],
  )

  return {
    homepageSlots,
    articlePlacements,
    placementMap,
    placementTargets,
    hasUnpublishedPlacements,
    loadHomepageSlots,
    loadArticlePlacements,
    applyDropPlacement,
    applyRemovePlacement,
    applyMovePlacement,
    publishHomepageChanges,
  }
}
