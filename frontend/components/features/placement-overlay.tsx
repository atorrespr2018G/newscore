'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import {
  placementTargetKey,
  useEditorPlacement,
  usePlacementSlotId,
} from '@/context/editor-placement-context'
import type { IArticle } from '@/interfaces/article'
import { consumeDraggingArticleId } from '@/lib/editor/editor-drag-store'
import type { PlacementMoveDirectionType } from '@/lib/helpers/editor-placement'
import type { IPlacementTarget } from '@/lib/helpers/editor-placement-targets'

type AdminTranslatorType = (key: string, values?: Record<string, string | number>) => string

const CELL_ACTION_CLASS =
  'inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 shadow-sm hover:bg-neutral-100 disabled:opacity-40'

/**
 * Resolve the dragged story id from a drop event.
 *
 * Falls back to the cross-window drag store when the native dataTransfer payload
 * is empty, which happens when the drag originates in another browser window.
 *
 * @param event Native drop event on a placement target.
 * @returns The dragged story id, or an empty string when none is available.
 */
function resolveDroppedArticleId(event: React.DragEvent): string {
  const transferTypes = ['text/plain', 'text', 'Text'] as const
  for (const transferType of transferTypes) {
    const value = event.dataTransfer.getData(transferType).trim()
    if (value) {
      return value
    }
  }
  return consumeDraggingArticleId()?.trim() ?? ''
}

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

interface IPlacementCellToolbarProps {
  target: IPlacementTarget
  canMoveUp: boolean
  canMoveDown: boolean
  saving: boolean
  t: AdminTranslatorType
  onRemovePlacement: (target: IPlacementTarget) => void
  onMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => void
}

/**
 * Floating move/remove controls shown over an occupied placement card.
 *
 * @param props Target metadata, capability flags, and placement callbacks.
 * @returns Toolbar of placement actions for the occupant story.
 */
function PlacementCellToolbar(props: IPlacementCellToolbarProps): JSX.Element {
  const { target, canMoveUp, canMoveDown, saving, t, onRemovePlacement, onMovePlacement } = props
  const cellRef = `${target.slotLabel} #${target.index + 1}`

  /**
   * Run a placement action without triggering the card's drop or link behavior.
   *
   * @param event Originating mouse event from a toolbar button.
   * @param action Placement mutation to invoke.
   */
  function handleAction(event: React.MouseEvent, action: () => void): void {
    event.preventDefault()
    event.stopPropagation()
    action()
  }

  return (
    <div
      className="absolute right-1 top-1 z-10 flex flex-wrap justify-end gap-1 opacity-0 transition-opacity group-hover/placement:opacity-100 group-focus-within/placement:opacity-100"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={saving || !canMoveUp}
        aria-label={t('editor.canvas.actions.moveUpAria', { cell: cellRef })}
        onClick={(event) => handleAction(event, () => onMovePlacement(target, 'up'))}
        className={CELL_ACTION_CLASS}
      >
        <ArrowUpIcon />
        {t('editor.canvas.actions.moveUp')}
      </button>
      <button
        type="button"
        disabled={saving || !canMoveDown}
        aria-label={t('editor.canvas.actions.moveDownAria', { cell: cellRef })}
        onClick={(event) => handleAction(event, () => onMovePlacement(target, 'down'))}
        className={CELL_ACTION_CLASS}
      >
        <ArrowDownIcon />
        {t('editor.canvas.actions.moveDown')}
      </button>
      <button
        type="button"
        disabled={saving}
        aria-label={t('editor.canvas.actions.removeAria', { cell: cellRef })}
        onClick={(event) => handleAction(event, () => onRemovePlacement(target))}
        className={`${CELL_ACTION_CLASS} text-red-600 hover:bg-red-50`}
      >
        <RemoveIcon />
        {t('editor.canvas.actions.remove')}
      </button>
    </div>
  )
}

interface IPlacementEditableCardProps {
  target: IPlacementTarget
  isSelected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  children: ReactNode
}

/**
 * Wrap a rendered homepage card with drag/drop and move/remove placement controls.
 *
 * Only mounted when an editor placement context is active, so the admin
 * translations and interaction handlers never run on the public site.
 *
 * @param props Resolved target, selection flag, move capabilities, and the card.
 * @returns Interactive placement wrapper around the homepage card.
 */
function PlacementEditableCard(props: IPlacementEditableCardProps): JSX.Element {
  const { target, isSelected, canMoveUp, canMoveDown, children } = props
  const editor = useEditorPlacement()
  const t = useTranslations('admin')
  // The provider always exists here; the guard narrows the nullable context.
  if (!editor) {
    return <>{children}</>
  }
  const { saving, selectedArticleId, onDropPlacement, onRemovePlacement, onMovePlacement } = editor

  return (
    <div
      role="group"
      tabIndex={selectedArticleId !== null && !saving ? 0 : -1}
      aria-label={t('editor.canvas.dropTargetAria', { cell: `${target.slotLabel} ${target.index + 1}` })}
      className={[
        'group/placement relative rounded outline-offset-2 transition-shadow',
        isSelected ? 'outline outline-2 outline-brand' : 'outline-dashed outline-1 outline-transparent hover:outline-neutral-300',
      ].join(' ')}
      onClickCapture={(event) => {
        // Suppress article navigation so clicking a card never leaves the canvas.
        event.preventDefault()
      }}
      onDragOver={(event) => {
        if (!saving) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (saving) {
          return
        }
        const draggedArticleId = resolveDroppedArticleId(event)
        if (draggedArticleId) {
          onDropPlacement(draggedArticleId, target)
        }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || selectedArticleId === null || saving) {
          return
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        onDropPlacement(selectedArticleId, target)
      }}
    >
      <PlacementCellToolbar
        target={target}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        saving={saving}
        t={t}
        onRemovePlacement={onRemovePlacement}
        onMovePlacement={onMovePlacement}
      />
      {children}
    </div>
  )
}

interface IPlacementDropOnlyCardProps {
  target: IPlacementTarget
  children: ReactNode
}

/**
 * Wrap a backfill/empty homepage cell so a pool story can be dropped into it.
 *
 * Unlike {@link PlacementEditableCard} this renders no move/remove toolbar
 * because the underlying cell holds no staged pin; it only accepts a drop at its
 * fixed grid index. This is what lets sparse slots such as the hero receive a
 * story on any visible card, not just on the rare card backed by a pin.
 *
 * @param props The positional drop target and the rendered card markup.
 * @returns A drop-enabled wrapper around the homepage card.
 */
function PlacementDropOnlyCard({ target, children }: IPlacementDropOnlyCardProps): JSX.Element {
  const editor = useEditorPlacement()
  const t = useTranslations('admin')
  if (!editor) {
    return <>{children}</>
  }
  const { saving, selectedArticleId, onDropPlacement } = editor

  return (
    <div
      role="group"
      tabIndex={selectedArticleId !== null && !saving ? 0 : -1}
      aria-label={t('editor.canvas.dropTargetAria', { cell: `${target.slotLabel} ${target.index + 1}` })}
      className="group/placement relative rounded outline-offset-2 outline-dashed outline-1 outline-transparent transition-shadow hover:outline-neutral-300"
      onClickCapture={(event) => {
        // Suppress article navigation so clicking a card never leaves the canvas.
        event.preventDefault()
      }}
      onDragOver={(event) => {
        if (!saving) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (saving) {
          return
        }
        const draggedArticleId = resolveDroppedArticleId(event)
        if (draggedArticleId) {
          onDropPlacement(draggedArticleId, target)
        }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || selectedArticleId === null || saving) {
          return
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        onDropPlacement(selectedArticleId, target)
      }}
    >
      {children}
    </div>
  )
}

interface IPlacementOverlayProps {
  article: IArticle
  /**
   * Opt a backfill/empty card into accepting drops. Sparse slots such as the
   * hero render almost no pinned cards, so without this their visible cards
   * would reject every drop.
   */
  editorDroppable?: boolean
  children: ReactNode
}

/**
 * Make a rendered homepage card interactive inside the editor canvas.
 *
 * A card backed by a staged pin gets the full move/remove toolbar and inserts a
 * dropped story before it. A backfill or empty card opted into `editorDroppable`
 * accepts a drop that appends the story after the slot's pins. The public site
 * (no editor context) renders the children untouched.
 *
 * @param props The article, whether the card accepts drops, and the card markup.
 * @returns The card, optionally wrapped with placement controls.
 */
export function PlacementOverlay({ article, editorDroppable, children }: IPlacementOverlayProps): JSX.Element {
  const editor = useEditorPlacement()
  const slotId = usePlacementSlotId()
  if (!editor || !slotId) {
    return <>{children}</>
  }
  const info = editor.pinnedInfoBySlotId.get(slotId)
  if (info == null) {
    return <>{children}</>
  }
  const pinnedIndex = info.indexByArticleId.get(article.id)
  if (pinnedIndex != null) {
    const target = editor.placementTargetByKey.get(placementTargetKey(slotId, pinnedIndex))
    if (target) {
      return (
        <PlacementEditableCard
          target={target}
          isSelected={article.id === editor.selectedArticleId}
          canMoveUp={pinnedIndex > 0}
          canMoveDown={pinnedIndex < info.count - 1}
        >
          {children}
        </PlacementEditableCard>
      )
    }
  }
  if (editorDroppable && info.templateTarget) {
    const appendTarget: IPlacementTarget = {
      ...info.templateTarget,
      index: info.appendIndex,
      articleId: null,
    }
    return <PlacementDropOnlyCard target={appendTarget}>{children}</PlacementDropOnlyCard>
  }
  return <>{children}</>
}

/**
 * Append-target drop zone rendered at the end of a slot's section.
 *
 * @returns A drop zone for adding a pool story, or null when not editable.
 */
export function PlacementSectionDropZone(): JSX.Element | null {
  const editor = useEditorPlacement()
  const slotId = usePlacementSlotId()
  const t = useTranslations('admin')
  if (!editor || !slotId) {
    return null
  }
  const info = editor.pinnedInfoBySlotId.get(slotId)
  if (!info || !info.templateTarget) {
    return null
  }
  const appendTarget: IPlacementTarget = {
    ...info.templateTarget,
    index: info.appendIndex,
    articleId: null,
  }
  const { saving, onDropPlacement } = editor

  return (
    <div
      role="button"
      tabIndex={editor.selectedArticleId !== null && !saving ? 0 : -1}
      aria-label={t('editor.canvas.dropZone')}
      className="mt-4 rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-center text-xs text-neutral-500 transition-colors hover:border-brand hover:bg-brand/5"
      onDragOver={(event) => {
        if (!saving) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (saving) {
          return
        }
        const draggedArticleId = resolveDroppedArticleId(event)
        if (draggedArticleId) {
          onDropPlacement(draggedArticleId, appendTarget)
        }
      }}
      onKeyDown={(event) => {
        if (editor.selectedArticleId === null || saving) {
          return
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        onDropPlacement(editor.selectedArticleId, appendTarget)
      }}
    >
      {t('editor.canvas.dropZone')}
    </div>
  )
}
