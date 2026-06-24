'use client'

/** Number of placeholder cards rendered while the pool loads. */
const POOL_SKELETON_CARD_COUNT = 6

/** Number of placeholder zones rendered while the canvas loads. */
const CANVAS_SKELETON_ZONE_COUNT = 3

/**
 * Placeholder grid shown while the editor story pool loads.
 *
 * @returns Animated skeleton cards approximating the pool layout.
 */
export function EditorPoolSkeleton(): JSX.Element {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      aria-hidden="true"
      data-testid="editor-pool-skeleton"
    >
      {Array.from({ length: POOL_SKELETON_CARD_COUNT }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
        >
          <div className="aspect-[16/9] w-full animate-pulse bg-neutral-200" />
          <div className="space-y-2 border-t border-neutral-100 p-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Placeholder zones shown while the placement canvas loads.
 *
 * @returns Animated skeleton matching the canvas zone layout.
 */
export function EditorCanvasSkeleton(): JSX.Element {
  return (
    <div
      className="rounded-lg border border-neutral-200 bg-white p-4"
      aria-hidden="true"
      data-testid="editor-canvas-skeleton"
    >
      <div className="h-5 w-48 animate-pulse rounded bg-neutral-200" />
      <div className="mt-4 space-y-4">
        {Array.from({ length: CANVAS_SKELETON_ZONE_COUNT }).map((_, index) => (
          <div key={index} className="rounded border border-neutral-200 p-3">
            <div className="mb-2 h-4 w-32 animate-pulse rounded bg-neutral-200" />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="h-20 animate-pulse rounded border border-dashed border-neutral-300 bg-neutral-50" />
              <div className="h-20 animate-pulse rounded border border-dashed border-neutral-300 bg-neutral-50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
