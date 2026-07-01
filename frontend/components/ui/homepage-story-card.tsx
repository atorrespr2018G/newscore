'use client'

import { PlacementOverlay } from '@/components/features/placement-overlay'
import { StoryCard, type IStoryCardProps } from '@/components/ui/story-card'
import { useEditorialArticlePreview } from '@/context/editorial-article-preview-context'

/** Homepage story card props plus the optional editor drop opt-in. */
interface IHomepageStoryCardProps extends IStoryCardProps {
  /** Allow this card to accept editor drops even when it shows a backfill story. */
  editorDroppable?: boolean
}

/**
 * Homepage story card with underline-on-hover and normal-weight titles.
 *
 * Wrapped in a placement overlay so the same card becomes an interactive
 * drop/move/remove target inside the editor canvas, while rendering untouched
 * on the public homepage.
 *
 * @param props Story card props plus the optional editor drop opt-in.
 * @returns The placement-aware homepage story card.
 */
export function HomepageStoryCard({ editorDroppable, ...props }: IHomepageStoryCardProps): JSX.Element {
  const preview = useEditorialArticlePreview()

  return (
    <PlacementOverlay article={props.article} editorDroppable={editorDroppable}>
      <StoryCard
        {...props}
        underlineOnHover={props.underlineOnHover ?? true}
        plainTitle={props.plainTitle ?? true}
        onArticleClick={preview?.openPreview}
      />
    </PlacementOverlay>
  )
}
