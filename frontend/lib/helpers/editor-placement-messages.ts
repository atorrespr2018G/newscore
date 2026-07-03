import { apiConfig } from '@/lib/api/config'
import { patchSlotDraftPinnedIds, type ISlotOut } from '@/lib/api/layout-client'
import { apiFetch } from '@/lib/api/rest-client'
import type { IPlacementMutationResult, PlacementMoveDirectionType } from '@/lib/helpers/editor-placement'
import { resolveSlotLabel, type IPlacementTarget } from '@/lib/helpers/editor-placement-targets'
import type { AdminTranslatorType, IArticleDetail } from '@/interfaces/editor-article'

type PlacementMutation = IPlacementMutationResult

interface ICategoryCascadeOptions {
  slots: ISlotOut[]
  categoryIds: string[]
  categorySlugById: Map<string, string>
  targetSlotId: string
}

interface IPlacementMessageOptions {
  t: AdminTranslatorType
  mutation: PlacementMutation
  previousSlots: ISlotOut[]
  articleId: string
  articleTitleById: Map<string, string>
  target: IPlacementTarget
  cascadeCount: number
}

/**
 * Build the localized banner reporting how many slots were published.
 *
 * @param t Admin-namespace translator.
 * @param publishedSlotCount Number of slots whose draft pins went live.
 * @returns Localized publish-result banner text.
 */
export function formatPublishResult(t: AdminTranslatorType, publishedSlotCount: number): string {
  if (publishedSlotCount === 0) {
    return t('editor.publishResult.none')
  }
  return t('editor.publishResult.count', { count: publishedSlotCount })
}

/**
 * Commit a staged placement mutation with optimistic slot updates.
 *
 * @param mutation Slot patch set to apply.
 * @param previousSlots Slots before the mutation (for rollback).
 * @param onOptimistic Applies the optimistic draft pins to local state.
 * @returns Merged slots after the server patches resolve.
 */
export async function commitPlacementMutation(
  mutation: PlacementMutation,
  previousSlots: ISlotOut[],
  onOptimistic: (slots: ISlotOut[]) => void,
): Promise<ISlotOut[]> {
  const optimisticById = new Map(
    mutation.updates.map((update) => [update.slotId, update.draftPinnedIds]),
  )
  const optimisticSlots = previousSlots.map((slot) =>
    optimisticById.has(slot.id)
      ? { ...slot, draft_pinned_ids: optimisticById.get(slot.id) ?? [] }
      : slot,
  )
  onOptimistic(optimisticSlots)
  const updatedSlots = await Promise.all(
    mutation.updates.map(async (update) =>
      patchSlotDraftPinnedIds(update.slotId, update.draftPinnedIds),
    ),
  )
  const updatedById = new Map(updatedSlots.map((slot) => [slot.id, slot]))
  return optimisticSlots.map((slot) => updatedById.get(slot.id) ?? slot)
}

/**
 * Fetch the categories a story belongs to from its detail endpoint.
 *
 * @param articleId Article id to look up.
 * @returns Category ids assigned to the article.
 * @throws ApiError When the detail request fails.
 */
export async function fetchArticleCategoryIds(articleId: string): Promise<string[]> {
  const detail = await apiFetch<IArticleDetail>(`${apiConfig.news}/articles/${articleId}`)
  return detail.category_ids ?? []
}

/**
 * Resolve homepage slot ids matching a story's categories for cascade pins.
 *
 * Categories without a homepage section slot are skipped silently, and the
 * drop target slot itself is never included in the cascade.
 *
 * @param options Slots, category ids, slug lookup, and the excluded target slot.
 * @returns Slot ids of category sections to pin the story into.
 */
export function resolveCategoryCascadeSlotIds(options: ICategoryCascadeOptions): string[] {
  const { slots, categoryIds, categorySlugById, targetSlotId } = options
  const targetSlugs = new Set(
    categoryIds
      .map((categoryId) => categorySlugById.get(categoryId)?.trim().toLowerCase())
      .filter((slug): slug is string => Boolean(slug)),
  )
  return slots
    .filter(
      (slot) =>
        slot.id !== targetSlotId &&
        slot.content_type === 'articles' &&
        targetSlugs.has(slot.position_key.trim().toLowerCase()),
    )
    .map((slot) => slot.id)
}

/**
 * Describe the localized cascade portion of a staged placement banner.
 *
 * @param t Admin-namespace translator.
 * @param cascadeCount Number of category sections the story was pinned into.
 * @returns Banner suffix naming the cascade, or an empty string when none.
 */
export function formatCascadeSuffix(t: AdminTranslatorType, cascadeCount: number): string {
  if (cascadeCount <= 0) {
    return ''
  }
  return t('editor.placement.cascadeSuffix', { count: cascadeCount })
}

/**
 * Build the localized staged-change banner for a drag-drop placement.
 *
 * @param options Translator, mutation, prior slots, lookup, target, and cascade count.
 * @returns Localized banner text for the placement.
 */
export function formatPlacementMessage(options: IPlacementMessageOptions): string {
  const { t, mutation, previousSlots, articleId, articleTitleById, target, cascadeCount } = options
  const title = articleTitleById.get(articleId) ?? articleId
  const destination = `${target.slotLabel} #${target.index + 1}`
  const cascade = formatCascadeSuffix(t, cascadeCount)
  if (!mutation.fromSlotId) {
    return t('editor.placement.staged', { title, destination, cascade })
  }
  const fromSlot = previousSlots.find((slot) => slot.id === mutation.fromSlotId)
  const fromLabel = fromSlot ? resolveSlotLabel(fromSlot) : t('editor.placement.fallbackSlot')
  const fromIndex = (mutation.fromIndex ?? 0) + 1
  return t('editor.placement.stagedMove', {
    title,
    from: `${fromLabel} #${fromIndex}`,
    destination,
    cascade,
  })
}

/**
 * Build the localized banner for removing a story from a slot.
 *
 * @param t Admin-namespace translator.
 * @param target Slot/index metadata for the removed placement.
 * @param articleTitleById Lookup of article titles by id.
 * @returns Localized removal banner text.
 */
export function formatRemoveMessage(
  t: AdminTranslatorType,
  target: IPlacementTarget,
  articleTitleById: Map<string, string>,
): string {
  const title = target.articleId
    ? articleTitleById.get(target.articleId) ?? target.articleId
    : t('editor.placement.fallbackTitle')
  const location = `${target.slotLabel} #${target.index + 1}`
  return t('editor.placement.removed', { title, location })
}

/**
 * Build the localized banner for reordering a story within a slot.
 *
 * @param t Admin-namespace translator.
 * @param target Slot/index metadata for the moved placement.
 * @param direction Reorder direction applied to the placement.
 * @param articleTitleById Lookup of article titles by id.
 * @returns Localized move banner text.
 */
export function formatMoveMessage(
  t: AdminTranslatorType,
  target: IPlacementTarget,
  direction: PlacementMoveDirectionType,
  articleTitleById: Map<string, string>,
): string {
  const title = target.articleId
    ? articleTitleById.get(target.articleId) ?? target.articleId
    : t('editor.placement.fallbackTitle')
  return t('editor.placement.moved', {
    title,
    direction: t(`editor.placement.directions.${direction}`),
    slot: target.slotLabel,
  })
}
