'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
import type { IArticle } from '@/interfaces/article'
import type { ISlotOut } from '@/lib/api/layout-client'
import type { PlacementMoveDirectionType } from '@/lib/helpers/editor-placement'
import { resolveSlotLabel, sortSlotsForEditorCanvas, type IPlacementTarget } from '@/lib/helpers/editor-placement-targets'

interface IHomepagePlacementCanvasProps {
  slots: ISlotOut[]
  targets: IPlacementTarget[]
  articleById: Map<string, IArticle>
  selectedArticleId: string | null
  saving: boolean
  statusMessage: string | null
  onDropPlacement: (articleId: string, target: IPlacementTarget) => void
  onRemovePlacement: (target: IPlacementTarget) => void
  onMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => void
}

type AdminTranslatorType = (key: string, values?: Record<string, string | number>) => string

interface IPlacementCellActionsProps {
  target: IPlacementTarget
  canMoveUp: boolean
  canMoveDown: boolean
  saving: boolean
  onRemovePlacement: (target: IPlacementTarget) => void
  onMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => void
}

const CELL_ACTION_CLASS =
  'inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40'

/**
 * Upward chevron glyph for the move-up control.
 *
 * @returns Inline SVG arrow.
 */
function ArrowUpIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none">
      <path d="M5 8V2M5 2L2 5M5 2l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Downward chevron glyph for the move-down control.
 *
 * @returns Inline SVG arrow.
 */
function ArrowDownIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none">
      <path d="M5 2v6M5 8L2 5M5 8l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Cross glyph for the remove control.
 *
 * @returns Inline SVG cross.
 */
function RemoveIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none">
      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Inline move/remove controls for an occupied placement cell.
 *
 * @param props Component props.
 * @returns Toolbar of placement actions for the occupant story.
 */
function PlacementCellActions(props: IPlacementCellActionsProps): JSX.Element {
  const { target, canMoveUp, canMoveDown, saving, onRemovePlacement, onMovePlacement } = props
  const t = useTranslations('admin')
  const cellRef = `${target.slotLabel} #${target.index + 1}`
  return (
    <div className="mt-2 flex flex-wrap gap-1" onKeyDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        disabled={saving || !canMoveUp}
        aria-label={t('editor.canvas.actions.moveUpAria', { cell: cellRef })}
        onClick={() => onMovePlacement(target, 'up')}
        className={CELL_ACTION_CLASS}
      >
        <ArrowUpIcon />
        {t('editor.canvas.actions.moveUp')}
      </button>
      <button
        type="button"
        disabled={saving || !canMoveDown}
        aria-label={t('editor.canvas.actions.moveDownAria', { cell: cellRef })}
        onClick={() => onMovePlacement(target, 'down')}
        className={CELL_ACTION_CLASS}
      >
        <ArrowDownIcon />
        {t('editor.canvas.actions.moveDown')}
      </button>
      <button
        type="button"
        disabled={saving}
        aria-label={t('editor.canvas.actions.removeAria', { cell: cellRef })}
        onClick={() => onRemovePlacement(target)}
        className={`${CELL_ACTION_CLASS} text-red-600 hover:bg-red-50`}
      >
        <RemoveIcon />
        {t('editor.canvas.actions.remove')}
      </button>
    </div>
  )
}

interface IPlacementCellProps {
  target: IPlacementTarget
  occupantArticle: IArticle | undefined
  isSelected: boolean
  canKeyboardPlace: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  saving: boolean
  selectedArticleId: string | null
  t: AdminTranslatorType
  onDropPlacement: (articleId: string, target: IPlacementTarget) => void
  onRemovePlacement: (target: IPlacementTarget) => void
  onMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => void
}

/**
 * Render a single drop target cell and its occupant story, if any.
 *
 * @param props Cell target metadata, occupant, and placement callbacks.
 * @returns The drop target cell.
 */
function PlacementCell(props: IPlacementCellProps): JSX.Element {
  const {
    target,
    occupantArticle,
    isSelected,
    canKeyboardPlace,
    canMoveUp,
    canMoveDown,
    saving,
    selectedArticleId,
    t,
    onDropPlacement,
    onRemovePlacement,
    onMovePlacement,
  } = props
  const occupantId = target.articleId
  return (
    <div
      role="button"
      tabIndex={canKeyboardPlace ? 0 : -1}
      aria-disabled={!canKeyboardPlace}
      aria-label={t('editor.canvas.dropTargetAria', {
        cell: `${target.slotLabel} ${target.index + 1}`,
      })}
      onDragOver={(event) => {
        if (!saving) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !canKeyboardPlace || selectedArticleId === null) {
          return
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        onDropPlacement(selectedArticleId, target)
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (saving) {
          return
        }
        const draggedArticleId = event.dataTransfer.getData('text/plain').trim()
        if (!draggedArticleId) {
          return
        }
        onDropPlacement(draggedArticleId, target)
      }}
      className={[
        'rounded border border-dashed p-2 text-xs',
        isSelected ? 'border-brand bg-brand/5' : 'border-neutral-300 bg-neutral-50',
      ].join(' ')}
    >
      <p className="font-medium text-neutral-700">
        {target.slotLabel} #{target.index + 1}
      </p>
      {occupantArticle ? (
        <div className="mt-2 space-y-2">
          <HomepageStoryThumb article={occupantArticle} className="max-w-[8rem]" />
          <p className="line-clamp-2 text-neutral-700">{occupantArticle.title}</p>
          {occupantArticle.status === 'draft' ? (
            <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              {t('editor.canvas.draftBadge')}
            </span>
          ) : null}
        </div>
      ) : occupantId ? (
        <p className="mt-1 line-clamp-2 text-neutral-600">
          {t('editor.canvas.occupied', { id: occupantId.slice(0, 8) })}
        </p>
      ) : (
        <p className="mt-1 text-neutral-500">{t('editor.canvas.emptyTarget')}</p>
      )}
      {occupantId ? (
        <PlacementCellActions
          target={target}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          saving={saving}
          onRemovePlacement={onRemovePlacement}
          onMovePlacement={onMovePlacement}
        />
      ) : null}
    </div>
  )
}

/**
 * Visual homepage drop zones grouped by slot.
 *
 * @param props Component props.
 * @returns Placement canvas UI.
 */
export function HomepagePlacementCanvas(props: IHomepagePlacementCanvasProps): JSX.Element {
  const {
    slots,
    targets,
    articleById,
    selectedArticleId,
    saving,
    statusMessage,
    onDropPlacement,
    onRemovePlacement,
    onMovePlacement,
  } = props
  const t = useTranslations('admin')
  const orderedSlots = useMemo(() => sortSlotsForEditorCanvas(slots), [slots])
  const targetsBySlot = useMemo(() => {
    const grouped = new Map<string, IPlacementTarget[]>()
    for (const target of targets) {
      const row = grouped.get(target.slotId)
      if (row) {
        row.push(target)
      } else {
        grouped.set(target.slotId, [target])
      }
    }
    return grouped
  }, [targets])

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-serif text-lg font-semibold">{t('editor.canvas.title')}</h2>
      <p className="mt-1 text-xs text-neutral-500">{t('editor.canvas.description')}</p>
      {statusMessage ? (
        <p className="mt-2 rounded bg-neutral-50 px-2 py-1 text-xs text-neutral-600">{statusMessage}</p>
      ) : null}
      <div className="mt-4 space-y-4">
        {orderedSlots.map((slot) => {
          const slotTargets = (targetsBySlot.get(slot.id) ?? []).sort((left, right) => left.index - right.index)
          const occupiedIndexes = slotTargets.filter((entry) => entry.articleId).map((entry) => entry.index)
          const firstOccupiedIndex = occupiedIndexes[0]
          const lastOccupiedIndex = occupiedIndexes[occupiedIndexes.length - 1]
          const isArticleSlot = slot.content_type === 'articles'
          const slotName = resolveSlotLabel(slot)
          return (
            <div key={slot.id} className="rounded border border-neutral-200 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-neutral-800">{slotName}</p>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  {slot.presentation_type} · {slot.content_type}
                </p>
              </div>
              {!isArticleSlot ? (
                <p className="text-xs text-neutral-500">{t('editor.canvas.nonArticleSlot')}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {slotTargets.map((target) => {
                    const occupantId = target.articleId
                    const occupantArticle = occupantId ? articleById.get(occupantId) : undefined
                    const isSelected = occupantId != null && occupantId === selectedArticleId
                    const canKeyboardPlace = !saving && selectedArticleId !== null
                    return (
                      <PlacementCell
                        key={`${target.slotId}:${target.index}`}
                        target={target}
                        occupantArticle={occupantArticle}
                        isSelected={isSelected}
                        canKeyboardPlace={canKeyboardPlace}
                        canMoveUp={target.index !== firstOccupiedIndex}
                        canMoveDown={target.index !== lastOccupiedIndex}
                        saving={saving}
                        selectedArticleId={selectedArticleId}
                        t={t}
                        onDropPlacement={onDropPlacement}
                        onRemovePlacement={onRemovePlacement}
                        onMovePlacement={onMovePlacement}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
