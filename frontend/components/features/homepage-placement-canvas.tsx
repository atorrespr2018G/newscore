'use client'

import { useMemo } from 'react'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
import type { IArticle } from '@/interfaces/article'
import type { ISlotOut } from '@/lib/api/layout-client'
import { resolveSlotLabel, sortSlotsForEditorCanvas, type IPlacementTarget } from '@/lib/helpers/editor-placement-targets'

interface IHomepagePlacementCanvasProps {
  slots: ISlotOut[]
  targets: IPlacementTarget[]
  articleById: Map<string, IArticle>
  selectedArticleId: string | null
  saving: boolean
  onDropPlacement: (articleId: string, target: IPlacementTarget) => void
}

/**
 * Visual homepage drop zones grouped by slot.
 *
 * @param props Component props.
 * @returns Placement canvas UI.
 */
export function HomepagePlacementCanvas(props: IHomepagePlacementCanvasProps): JSX.Element {
  const { slots, targets, articleById, selectedArticleId, saving, onDropPlacement } = props
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
      <h2 className="font-serif text-lg font-semibold">Homepage placement canvas</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Drag a story card here to place or move it between named homepage zones.
      </p>
      <div className="mt-4 space-y-4">
        {orderedSlots.map((slot) => {
          const slotTargets = (targetsBySlot.get(slot.id) ?? []).sort((left, right) => left.index - right.index)
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
                <p className="text-xs text-neutral-500">Drop disabled for non-article slot types.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {slotTargets.map((target) => {
                    const occupantId = target.articleId
                    const occupantArticle = occupantId ? articleById.get(occupantId) : undefined
                    const isSelected = occupantId != null && occupantId === selectedArticleId
                    return (
                      <div
                        key={`${target.slotId}:${target.index}`}
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
                                Draft
                              </span>
                            ) : null}
                          </div>
                        ) : occupantId ? (
                          <p className="mt-1 line-clamp-2 text-neutral-600">
                            Occupied: {occupantId.slice(0, 8)}
                          </p>
                        ) : (
                          <p className="mt-1 text-neutral-500">Empty target</p>
                        )}
                      </div>
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
