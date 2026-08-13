'use client'

import {
  useCallback,
  useEffect,
  useState,
  type DragEvent,
} from 'react'

import { moveListItem } from '@/lib/helpers/move-list-item'

/** Invisible 1×1 gif used to hide the browser's default drag ghost. */
const EMPTY_DRAG_IMAGE_SRC =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export interface ISortableDragPreviewState {
  index: number
  x: number
  y: number
  width: number
  height: number
}

interface IUseSortableListDragOptions<T> {
  items: T[]
  onReorder: (next: T[]) => void
}

interface IUseSortableListDragResult {
  dragIndex: number | null
  overIndex: number | null
  preview: ISortableDragPreviewState | null
  beginDrag: (options: {
    index: number
    event: DragEvent
    rowRef: { current: HTMLElement | null }
  }) => void
  updatePointer: (event: DragEvent) => void
  setHoverIndex: (index: number) => void
  completeDrop: (toIndex: number) => void
  clearDrag: () => void
}

/**
 * HTML5 list reordering with a floating preview that follows the pointer.
 *
 * @param options - Current items and reorder callback.
 * @returns Drag state helpers for sortable config rows.
 */
export function useSortableListDrag<T>(
  options: IUseSortableListDragOptions<T>,
): IUseSortableListDragResult {
  const { items, onReorder } = options
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<ISortableDragPreviewState | null>(null)

  const clearDrag = useCallback((): void => {
    setDragIndex(null)
    setOverIndex(null)
    setPreview(null)
  }, [])

  useEffect(() => {
    if (dragIndex === null) {
      return
    }
    const onUp = (): void => clearDrag()
    window.addEventListener('dragend', onUp)
    return () => window.removeEventListener('dragend', onUp)
  }, [dragIndex, clearDrag])

  const beginDrag = useCallback(
    ({
      index,
      event,
      rowRef,
    }: {
      index: number
      event: DragEvent
      rowRef: { current: HTMLElement | null }
    }): void => {
      const row = rowRef.current
      if (!row) {
        return
      }
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
      hideDefaultDragGhost(event)
      const rect = row.getBoundingClientRect()
      setDragIndex(index)
      setOverIndex(index)
      setPreview({
        index,
        x: event.clientX,
        y: event.clientY,
        width: rect.width,
        height: rect.height,
      })
    },
    [],
  )

  const updatePointer = useCallback((event: DragEvent): void => {
    if (event.clientX === 0 && event.clientY === 0) {
      return
    }
    setPreview((current) =>
      current
        ? { ...current, x: event.clientX, y: event.clientY }
        : current,
    )
  }, [])

  const setHoverIndex = useCallback((index: number): void => {
    setOverIndex(index)
  }, [])

  const completeDrop = useCallback(
    (toIndex: number): void => {
      if (dragIndex === null) {
        clearDrag()
        return
      }
      onReorder(moveListItem(items, dragIndex, toIndex))
      clearDrag()
    },
    [clearDrag, dragIndex, items, onReorder],
  )

  return {
    dragIndex,
    overIndex,
    preview,
    beginDrag,
    updatePointer,
    setHoverIndex,
    completeDrop,
    clearDrag,
  }
}

/**
 * Replace the native drag ghost with a transparent pixel.
 *
 * @param event - Drag start event from the handle.
 */
function hideDefaultDragGhost(event: DragEvent): void {
  const ghost = new Image()
  ghost.src = EMPTY_DRAG_IMAGE_SRC
  event.dataTransfer.setDragImage(ghost, 0, 0)
}
