import { StoryCard, type IStoryCardProps } from '@/components/ui/story-card'

/**
 * Homepage story card with underline-on-hover and normal-weight titles.
 */
export function HomepageStoryCard(props: IStoryCardProps): JSX.Element {
  return <StoryCard {...props} underlineOnHover plainTitle={props.plainTitle ?? true} />
}
