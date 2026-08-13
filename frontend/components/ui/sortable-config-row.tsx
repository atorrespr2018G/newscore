'use client'

import {
  useRef,
  type DragEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import type { ISortableDragPreviewState } from '@/hooks/use-sortable-list-drag'

interface ISortableConfigRowProps {
  index: number
  isDragging: boolean
  isDropTarget: boolean
  dragHandleLabel: string
  onDragStart: (options: {
    index: number
    event: DragEvent
    rowRef: { current: HTMLElement | null }
  }) => void
  onDrag: (event: DragEvent) => void
  onDragOver: (index: number) => void
  onDrop: (index: number) => void
  children: ReactNode
}

/**
 * Configuration list row with a drag handle and drop-target highlighting.
 *
 * @param props - Row index, drag callbacks, and row body.
 * @returns Sortable list item markup.
 */
export function SortableConfigRow(props: ISortableConfigRowProps): JSX.Element {
  const {
    index,
    isDragging,
    isDropTarget,
    dragHandleLabel,
    onDragStart,
    onDrag,
    onDragOver,
    onDrop,
    children,
  } = props
  const rowRef = useRef<HTMLLIElement>(null)

  return (
    <li
      ref={rowRef}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(index)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(index)
      }}
      className={[
        'flex flex-wrap items-center gap-2 rounded border bg-white p-3 transition',
        isDragging ? 'border-dashed border-neutral-400 opacity-40' : 'border-neutral-200',
        isDropTarget && !isDragging ? 'border-brand ring-2 ring-brand/30' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        draggable
        aria-label={dragHandleLabel}
        title={dragHandleLabel}
        onDragStart={(event) => onDragStart({ index, event, rowRef })}
        onDrag={onDrag}
        className="cursor-grab touch-none rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-neutral-600 active:cursor-grabbing"
      >
        <span aria-hidden="true" className="text-sm leading-none tracking-tighter">
          ⋮⋮
        </span>
      </button>
      {children}
    </li>
  )
}

interface ISortableDragPreviewProps {
  preview: ISortableDragPreviewState
  children: ReactNode
}

/**
 * Floating clone of the dragged config row that follows the pointer.
 *
 * @param props - Preview geometry and row content.
 * @returns Portal overlay, or null before mount.
 */
export function SortableDragPreview({
  preview,
  children,
}: ISortableDragPreviewProps): JSX.Element | null {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[1000] rounded border border-neutral-400 bg-white p-3 shadow-2xl"
      style={{
        left: preview.x + 12,
        top: preview.y + 12,
        width: preview.width,
        minHeight: preview.height,
        opacity: 0.95,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-neutral-600">
          <span aria-hidden="true" className="text-sm leading-none tracking-tighter">
            ⋮⋮
          </span>
        </span>
        {children}
      </div>
    </div>,
    document.body,
  )
}
