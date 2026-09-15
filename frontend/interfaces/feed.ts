import type { IArticle } from './article'
import type { IPageAdPlacement } from '@/lib/helpers/page-ad-placements'

export interface IFeedSlot {
  id: string
  positionKey: string
  displayName: string | null
  presentationType: string
  contentType: string
  articles: IArticle[]
}

export interface IHomepageFeed {
  layoutId: string
  pageName: string
  slots: IFeedSlot[]
  adPlacements: IPageAdPlacement[]
  /** False when this landing is disabled for the active geo. */
  isEnabled: boolean
  /** Layout page names hidden for the active geo (includes ancestor disables). */
  disabledPageNames: string[]
}

