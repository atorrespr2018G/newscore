'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { HomepagePreviewPane } from '@/components/features/homepage-preview-pane'
import { PreviewPublishPanel } from '@/components/features/preview-publish-panel'
import { useHomepagePreviewFeed } from '@/hooks/use-homepage-preview-feed'
import { useMarkWorkflowViewSeen } from '@/hooks/use-workflow-badges'
import { layoutHasUnpublishedPlacementChanges } from '@/lib/helpers/slot-editor-pinned-ids'

/**
 * Full-page homepage preview for editors (draft pins, review approvals, and publishing).
 *
 * @returns Standalone preview workspace.
 */
export default function PreviewPage(): JSX.Element {
  const t = useTranslations('admin')
  const { previewFeed, homepageSlots, loading, refreshing, error, refresh } = useHomepagePreviewFeed()
  useMarkWorkflowViewSeen('review')

  const hasUnpublishedPlacements = useMemo(
    () => layoutHasUnpublishedPlacementChanges(homepageSlots),
    [homepageSlots],
  )

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{t('preview.heading')}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t('preview.subtitle')}</p>

      <div className="mt-6 space-y-6">
        <PreviewPublishPanel
          feed={previewFeed}
          hasUnpublishedPlacements={hasUnpublishedPlacements}
          onPublished={refresh}
        />

        {loading && !previewFeed ? (
          <p className="text-neutral-600">{t('preview.loading')}</p>
        ) : (
          <HomepagePreviewPane
            feed={previewFeed}
            loading={refreshing}
            error={error}
            homepageSlots={homepageSlots}
            layout="standalone"
            onRefresh={() => void refresh()}
            refreshing={refreshing}
          />
        )}
      </div>
    </div>
  )
}
