'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getArticlePlacements, type IArticlePlacementOut } from '@/lib/api/layout-client'
import { editorScopeRegionCode } from '@/lib/editor/editor-scope'
import { buildArticlePlacementMap } from '@/lib/helpers/article-placements'
import type { IEditorScope } from '@/lib/editor/editor-scope'

interface IArticlePlacements {
  articlePlacements: Record<string, IArticlePlacementOut[]>
  placementMap: ReturnType<typeof buildArticlePlacementMap>
  loadArticlePlacements: () => Promise<void>
}

/**
 * Load the market's article-to-placement map for pool location labels.
 *
 * Shared by the News page (per-card "location" + the New tab) and the Placement
 * board (banners + post-mutation refresh), so the fetch logic lives in one place.
 *
 * @param scope Active editor market/page scope.
 * @returns Placement records, the derived lookup map, and a reload action.
 */
export function useArticlePlacements(scope: IEditorScope): IArticlePlacements {
  const [articlePlacements, setArticlePlacements] = useState<Record<string, IArticlePlacementOut[]>>({})

  const loadArticlePlacements = useCallback(async () => {
    const data = await getArticlePlacements(
      scope.marketCode,
      editorScopeRegionCode(scope),
      scope.townId,
    )
    setArticlePlacements(data.placements)
  }, [scope])

  const placementMap = useMemo(
    () => buildArticlePlacementMap(articlePlacements),
    [articlePlacements],
  )

  return { articlePlacements, placementMap, loadArticlePlacements }
}
