import type { Dispatch, SetStateAction } from 'react'
import type { ICategoryOut } from '@/lib/api/category-client'
import type { IStoryGroupOut } from '@/lib/api/story-group-client'
import type { IArticlePlacementOut, ISlotOut } from '@/lib/api/layout-client'
import type { buildArticlePlacementMap } from '@/lib/helpers/article-placements'
import type { IEditorSearchFilters } from '@/lib/helpers/editor-curation'
import type {
  buildPlacementTargets,
  IPlacementTarget,
} from '@/lib/helpers/editor-placement-targets'
import type { PlacementMoveDirectionType } from '@/lib/helpers/editor-placement'
import type { IHomepageFeed } from '@/interfaces/feed'

/** One row in the editor article pool (REST list/search shape). */
export interface IEditorStoryRow {
  id: string
  title: string
  slug: string
  status: string
  author_name: string
  thumbnail_url: string | null
  category_ids?: string[]
}

/** Article detail payload from the editor REST API. */
export interface IArticleDetail {
  id: string
  title: string
  body: string
  status: string
  media_ids: string[]
  video_url: string | null
  thumbnail_url: string | null
  max_image_count: number
  category_ids: string[]
  story_id: string | null
  international_potential: number | null
  market_ids: string[]
  direct_region_ids: string[]
  effective_region_ids: string[]
  primary_region_id: string | null
}

export interface IEditorScopeDebug {
  articleId: string
  queryPath: string
  primaryRegionId: string | null
  directRegionIds: string[]
  effectiveRegionIds: string[]
  regionToken: string | null
  regionLookupSource: 'code' | 'region-id' | 'none' | 'lookup-error'
  resolvedRegionCode: string | null
}

/** A media asset attached to an article (image or video). */
export interface ILoadedMedia {
  id: string
  url: string
  fileType: 'image' | 'video'
}

/**
 * Minimal translator signature for the `admin` namespace.
 *
 * Mirrors the `useTranslations('admin')` call surface editor hooks rely on so
 * localized banner/error copy can be built in module-level pure helpers.
 */
export type AdminTranslatorType = (key: string, values?: Record<string, string | number>) => string

/** Shared error/message/loading/saving banners for editor pages. */
export interface IEditorStatus {
  error: string | null
  message: string | null
  loading: boolean
  saving: boolean
  setError: Dispatch<SetStateAction<string | null>>
  setMessage: Dispatch<SetStateAction<string | null>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setSaving: Dispatch<SetStateAction<boolean>>
}

/** Article pool state and actions for the editor News page. */
export interface IEditorArticlePool {
  articles: IEditorStoryRow[]
  hasMoreArticles: boolean
  loadingMoreArticles: boolean
  loadArticles: () => Promise<void>
  loadMoreArticles: () => Promise<void>
  searchArticles: (filters: IEditorSearchFilters) => Promise<IEditorStoryRow[]>
  updateArticleRow: (articleId: string, patch: Partial<IEditorStoryRow>) => void
}

/** Selected-article media/publish editing workflow state and actions. */
export interface IArticleDetailEditor {
  selectedId: string | null
  articleIdInput: string
  setArticleIdInput: Dispatch<SetStateAction<string>>
  detail: IArticleDetail | null
  setDetail: Dispatch<SetStateAction<IArticleDetail | null>>
  scopeDebug: IEditorScopeDebug | null
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  body: string
  setBody: Dispatch<SetStateAction<string>>
  uploadingMedia: boolean
  uploadImages: (files: FileList | null) => Promise<void>
  uploadVideos: (files: FileList | null) => Promise<void>
  mediaItems: ILoadedMedia[]
  setMediaItems: Dispatch<SetStateAction<ILoadedMedia[]>>
  maxImageCount: number
  setMaxImageCount: Dispatch<SetStateAction<number>>
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  storyId: string
  setStoryId: Dispatch<SetStateAction<string>>
  storyGroups: IStoryGroupOut[]
  isDirty: boolean
  markDirty: () => void
  loadArticleDetail: (articleId: string) => Promise<void>
  loadArticleByIdInput: () => void
  saveArticleChanges: () => Promise<boolean>
  publishSelected: () => Promise<void>
  publishArticleById: (articleId: string) => Promise<void>
}

/** Homepage slot placement state and actions. */
export interface IHomepagePlacementEditor {
  homepageSlots: ISlotOut[]
  articlePlacements: Record<string, IArticlePlacementOut[]>
  placementMap: ReturnType<typeof buildArticlePlacementMap>
  placementTargets: ReturnType<typeof buildPlacementTargets>
  hasUnpublishedPlacements: boolean
  loadHomepageSlots: () => Promise<void>
  loadArticlePlacements: () => Promise<void>
  applyDropPlacement: (articleId: string, target: IPlacementTarget) => Promise<boolean>
  applyRemovePlacement: (target: IPlacementTarget) => Promise<void>
  applyMovePlacement: (target: IPlacementTarget, direction: PlacementMoveDirectionType) => Promise<void>
  publishHomepageChanges: () => Promise<void>
}

/** Public surface of the editor News page hook. */
export interface IEditorNews
  extends Omit<IArticleDetailEditor, 'setDetail'>,
    Pick<
      IEditorArticlePool,
      'articles' | 'searchArticles' | 'hasMoreArticles' | 'loadingMoreArticles' | 'loadMoreArticles'
    > {
  loading: boolean
  error: string | null
  message: string | null
  saving: boolean
  placementMap: ReturnType<typeof buildArticlePlacementMap>
}

/** Public surface of the editor Placement page hook. */
export interface IEditorPlacementBoard
  extends Omit<
    IHomepagePlacementEditor,
    'articlePlacements' | 'placementMap' | 'loadHomepageSlots' | 'loadArticlePlacements'
  > {
  loading: boolean
  error: string | null
  message: string | null
  saving: boolean
  previewFeed: IHomepageFeed | null
  previewLoading: boolean
  previewError: string | null
  refreshing: boolean
  refreshPreview: () => Promise<void>
}
