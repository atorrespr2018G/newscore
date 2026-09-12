'use client'

import { useEffect } from 'react'

interface IConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Close the dialog when Escape is pressed.
 *
 * @param onCancel Cancel handler invoked on Escape.
 */
function useEscapeToCancel(onCancel: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])
}

/**
 * Modal confirmation with Confirm and Cancel actions.
 *
 * @param props Dialog copy and action handlers.
 * @returns Overlay dialog markup.
 */
export function ConfirmDialog(props: IConfirmDialogProps): JSX.Element {
  const { title, message, confirmLabel, cancelLabel, onConfirm, onCancel } = props
  useEscapeToCancel(onCancel)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-neutral-900">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-neutral-600">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
