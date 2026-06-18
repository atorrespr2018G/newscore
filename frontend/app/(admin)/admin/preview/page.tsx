'use client'

import { useMemo } from 'react'
import { HomepagePreviewPane } from '@/components/features/homepage-preview-pane'
import { PreviewPublishPanel } from '@/components/features/preview-publish-panel'
import { useHomepagePreviewFeed } from '@/hooks/use-homepage-preview-feed'
import { layoutHasUnpublishedPlacementChanges } from '@/lib/helpers/slot-editor-pinned-ids'

/**
 * Full-page homepage preview for editors (draft pins and staged placements).
 *
 * @returns Standalone preview workspace.
 */
export default function PreviewPage(): JSX.Element {
  const { previewFeed, homepageSlots, loading, refreshing, error, refresh } = useHomepagePreviewFeed()

  const hasUnpublishedPlacements = useMemo(
    () => layoutHasUnpublishedPlacementChanges(homepageSlots),
    [homepageSlots],
  )

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Preview</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Review staged homepage layout and publish layout or story changes directly from this page.
      </p>

      <div className="mt-6 space-y-6">
        <PreviewPublishPanel
          feed={previewFeed}
          hasUnpublishedPlacements={hasUnpublishedPlacements}
          onPublished={refresh}
        />

        {loading && !previewFeed ? (
          <p className="text-neutral-600">Loading homepage preview…</p>
        ) : (
          <HomepagePreviewPane
            feed={previewFeed}
            loading={refreshing}
            error={error}
            layout="standalone"
            onRefresh={() => void refresh()}
            refreshing={refreshing}
          />
        )}
      </div>
    </div>
  )
}
