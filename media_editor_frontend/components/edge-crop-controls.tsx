'use client'

import { IEdgeCropInsets, IImageSize } from '@/lib/edge-crop'

interface IEdgeCropControlsProps {
  size: IImageSize | null
  insets: IEdgeCropInsets
  busy: boolean
  onChange: (insets: IEdgeCropInsets) => void
  onApply: () => void
}

const EMPTY_INSETS: IEdgeCropInsets = { left: 0, right: 0, top: 0, bottom: 0 }

/**
 * Numeric controls to trim left, right, top, and bottom edges independently.
 * @param props - Current insets, image size, and apply callback.
 * @returns Edge-crop control strip for the image studio.
 */
export function EdgeCropControls({
  size,
  insets,
  busy,
  onChange,
  onApply,
}: IEdgeCropControlsProps): JSX.Element {
  const maxWidth = size ? Math.max(0, size.width - 1) : 0
  const maxHeight = size ? Math.max(0, size.height - 1) : 0
  const remainingWidth = size ? size.width - insets.left - insets.right : null
  const remainingHeight = size ? size.height - insets.top - insets.bottom : null

  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-white">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">
            Independent edge crop
          </p>
          <p className="text-xs text-white/70">
            Move each side on its own (pixels from the edge)
            {size ? ` · source ${size.width}×${size.height}` : ''}
            {remainingWidth != null && remainingHeight != null
              ? ` · result ${Math.max(0, remainingWidth)}×${Math.max(0, remainingHeight)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-40"
            disabled={busy}
            onClick={() => onChange(EMPTY_INSETS)}
          >
            Clear edges
          </button>
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-slate-100 disabled:opacity-40"
            disabled={busy || !size}
            onClick={onApply}
          >
            {busy ? 'Applying…' : 'Apply edge crop'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <EdgeField
          label="Left"
          value={insets.left}
          max={maxWidth}
          disabled={busy || !size}
          onChange={(left) => onChange({ ...insets, left })}
        />
        <EdgeField
          label="Right"
          value={insets.right}
          max={maxWidth}
          disabled={busy || !size}
          onChange={(right) => onChange({ ...insets, right })}
        />
        <EdgeField
          label="Top"
          value={insets.top}
          max={maxHeight}
          disabled={busy || !size}
          onChange={(top) => onChange({ ...insets, top })}
        />
        <EdgeField
          label="Bottom"
          value={insets.bottom}
          max={maxHeight}
          disabled={busy || !size}
          onChange={(bottom) => onChange({ ...insets, bottom })}
        />
      </div>
    </div>
  )
}

interface IEdgeFieldProps {
  label: string
  value: number
  max: number
  disabled: boolean
  onChange: (value: number) => void
}

/** One labeled numeric field for a single crop edge. */
function EdgeField({ label, value, max, disabled, onChange }: IEdgeFieldProps): JSX.Element {
  return (
    <label className="block text-xs text-white/80">
      <span className="mb-1 block font-semibold uppercase tracking-[0.12em]">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        className="w-full rounded-lg border border-white/20 bg-brand-ink/40 px-2 py-1.5 text-sm text-white outline-none focus:border-white/50 disabled:opacity-40"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
