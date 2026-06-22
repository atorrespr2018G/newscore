'use client'

import { useRef, useState } from 'react'

interface ILocalizedFileInputProps {
  accept: string
  multiple?: boolean
  disabled?: boolean
  onSelect: (files: FileList | null) => void
  buttonLabel: string
  emptyLabel: string
  formatSelected: (count: number) => string
}

/**
 * Localized file picker that hides the browser's native file-input chrome.
 *
 * The native `<input type="file">` button text (e.g. "Choose Files" / "No file
 * chosen") is rendered by the browser and cannot be translated via the DOM, so
 * this control visually hides the real input and surfaces app-localized button
 * and status labels in its place.
 *
 * @param props Accept filter, selection callback, and localized labels.
 * @returns A styled, localizable file input control.
 */
export function LocalizedFileInput({
  accept,
  multiple = false,
  disabled = false,
  onSelect,
  buttonLabel,
  emptyLabel,
  formatSelected,
}: ILocalizedFileInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedCount, setSelectedCount] = useState(0)

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      >
        {buttonLabel}
      </button>
      <span className="text-sm text-neutral-500">
        {selectedCount > 0 ? formatSelected(selectedCount) : emptyLabel}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          setSelectedCount(event.target.files?.length ?? 0)
          onSelect(event.target.files)
        }}
        className="sr-only"
      />
    </div>
  )
}
