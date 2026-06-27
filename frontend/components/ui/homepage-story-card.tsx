import { PlacementOverlay } from '@/components/features/placement-overlay'
import { StoryCard, type IStoryCardProps } from '@/components/ui/story-card'

/**
 * Homepage story card with underline-on-hover and normal-weight titles.
 *
 * Wrapped in a placement overlay so the same card becomes an interactive
 * drop/move/remove target inside the editor canvas, while rendering untouched
 * on the public homepage.
 */
export function HomepageStoryCard(props: IStoryCardProps): JSX.Element {
  return (
    <PlacementOverlay article={props.article}>
      <StoryCard {...props} underlineOnHover plainTitle={props.plainTitle ?? true} />
    </PlacementOverlay>
  )
}
