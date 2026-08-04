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
}

