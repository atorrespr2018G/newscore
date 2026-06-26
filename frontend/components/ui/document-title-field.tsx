'use client'

import { useEffect, useRef } from 'react'

interface IDocumentTitleFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  maxLength: number
  formatCount: (count: number, max: number) => string
}

/**
 * Headline input styled as a document title with an auto-growing textarea.
 *
 * Renders as a large, borderless field that wraps long headlines onto multiple
 * lines and shows a live character count against the configured maximum.
 *
 * @param props Current value, change handler, labels, and max length.
 * @returns The headline title field with a character counter.
 */
export function DocumentTitleField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  maxLength,
  formatCount,
}: IDocumentTitleFieldProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow the textarea to fit its content so long headlines stay fully visible.
  useEffect(() => {
    const node = textareaRef.current
    if (!node) {
      return
    }
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value])

  return (
    <div className="mt-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        aria-label={ariaLabel}
        maxLength={maxLength}
        rows={1}
        className="block w-full resize-none border-0 border-b border-neutral-200 bg-transparent px-0 py-1 font-serif text-3xl font-bold leading-tight text-neutral-900 focus:border-brand focus:outline-none focus:ring-0"
      />
      <p className="mt-1 text-right text-xs text-neutral-400">{formatCount(value.length, maxLength)}</p>
    </div>
  )
}
