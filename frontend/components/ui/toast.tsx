'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/** Visual severity of a toast notification. */
export type ToastVariantType = 'success' | 'error' | 'info'

/** A single transient notification rendered in the toast stack. */
export interface IToast {
  id: string
  message: string
  variant: ToastVariantType
}

interface IToastContextValue {
  toasts: IToast[]
  pushToast: (message: string, variant?: ToastVariantType) => void
  dismissToast: (id: string) => void
}

/** Default lifetime before a toast auto-dismisses, in milliseconds. */
const TOAST_AUTO_DISMISS_MS = 5000

const ToastContext = createContext<IToastContextValue | null>(null)

interface IToastProviderProps {
  children: ReactNode
}

/**
 * Provide a stackable, auto-dismissing toast queue to descendant components.
 *
 * @param children Subtree that can raise toasts via `useToast`.
 * @returns Provider wrapping the toast viewport and children.
 */
export function ToastProvider({ children }: IToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<IToast[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const pushToast = useCallback(
    (message: string, variant: ToastVariantType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((current) => [...current, { id, message, variant }])
      const timer = window.setTimeout(() => dismissToast(id), TOAST_AUTO_DISMISS_MS)
      timersRef.current.set(id, timer)
    },
    [dismissToast],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  const value = useMemo(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

/**
 * Access the toast queue actions.
 *
 * @returns Push/dismiss handlers for transient notifications.
 * @throws Error When used outside ToastProvider.
 */
export function useToast(): Pick<IToastContextValue, 'pushToast' | 'dismissToast'> {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return { pushToast: context.pushToast, dismissToast: context.dismissToast }
}

interface IToastViewportProps {
  toasts: IToast[]
  onDismiss: (id: string) => void
}

const TOAST_VARIANT_CLASS: Record<ToastVariantType, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-neutral-200 bg-white text-neutral-800',
}

/**
 * Fixed, screen-reader-friendly stack of active toasts.
 *
 * @param props Active toasts and the dismiss handler.
 * @returns The toast stack overlay.
 */
function ToastViewport({ toasts, onDismiss }: IToastViewportProps): JSX.Element {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === 'error' ? 'alert' : 'status'}
          className={[
            'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-md',
            TOAST_VARIANT_CLASS[toast.variant],
          ].join(' ')}
        >
          <span className="min-w-0 flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-current/70 hover:text-current"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
