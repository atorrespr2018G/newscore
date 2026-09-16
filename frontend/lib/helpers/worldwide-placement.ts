/** Homepage slot options for worldwide placement. */

export interface IWorldwidePlacementSlotOption {
  positionKey: string
  labelKey: string
  maxPosition: number
}

/** Slots editors can fan out to across markets. */
export const WORLDWIDE_PLACEMENT_SLOT_OPTIONS: ReadonlyArray<IWorldwidePlacementSlotOption> = [
  { positionKey: 'hero', labelKey: 'editor.worldwide.slots.hero', maxPosition: 11 },
  {
    positionKey: 'more-top-stories',
    labelKey: 'editor.worldwide.slots.moreTopStories',
    maxPosition: 6,
  },
  {
    positionKey: 'more-top-stories-2',
    labelKey: 'editor.worldwide.slots.moreTopStories2',
    maxPosition: 6,
  },
]

/**
 * Resolve the max zero-based position for a worldwide placement slot.
 *
 * @param positionKey Layout slot position key.
 * @returns Inclusive max position index.
 */
export function worldwideSlotMaxPosition(positionKey: string): number {
  const match = WORLDWIDE_PLACEMENT_SLOT_OPTIONS.find((option) => option.positionKey === positionKey)
  return match?.maxPosition ?? 11
}
