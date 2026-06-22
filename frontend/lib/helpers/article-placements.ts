import type { IArticlePlacementOut } from '@/lib/api/layout-client'
import { homepageSectionTitle, staticSectionLabelTranslator } from '@/lib/helpers/section-labels'

/** Homepage slot placement for a single article. */
export interface IArticlePlacement {
  pageName: string
  positionKey: string
  displayName: string
  position: number
}

const PAGE_LABELS: Record<string, string> = {
  homepage: 'Homepage',
  world: 'World',
}

/**
 * Map API placement payloads to editor view models.
 *
 * @param placements Placement entries keyed by article id.
 * @returns Map keyed by article id.
 */
export function buildArticlePlacementMap(
  placements: Record<string, IArticlePlacementOut[]>,
): Map<string, IArticlePlacement[]> {
  const map = new Map<string, IArticlePlacement[]>()

  for (const [articleId, entries] of Object.entries(placements)) {
    map.set(
      articleId,
      entries.map((entry) => ({
        pageName: entry.page_name,
        positionKey: entry.position_key,
        displayName: entry.display_name,
        position: entry.position,
      })),
    )
  }

  return map
}

/**
 * Format slot placements for display in admin tables.
 *
 * @param placements Placement entries for one article.
 * @param maxItems Maximum placements to show before summarizing the rest.
 * @returns Human-readable placement summary.
 */
export function formatArticlePlacements(
  placements: IArticlePlacement[],
  maxItems = 3,
): string {
  if (placements.length === 0) {
    return 'Not placed'
  }

  const labels = placements.map((placement) => formatSinglePlacement(placement))
  if (labels.length <= maxItems) {
    return labels.join(', ')
  }

  const visible = labels.slice(0, maxItems).join(', ')
  const remaining = labels.length - maxItems
  return `${visible} (+${remaining} more)`
}

/**
 * Format one placement entry.
 *
 * Resolves the section label from the slot's position key (the canonical source
 * shared with the homepage and editor canvas) so the summary never surfaces a
 * stale or mismatched CMS `display_name`.
 *
 * @param placement Placement entry.
 * @returns Human-readable label.
 */
function formatSinglePlacement(placement: IArticlePlacement): string {
  const pageLabel = PAGE_LABELS[placement.pageName] ?? placement.pageName
  const sectionLabel = homepageSectionTitle(
    placement.positionKey,
    placement.displayName,
    staticSectionLabelTranslator,
    placement.pageName,
  )
  return `${pageLabel} · ${sectionLabel} #${placement.position}`
}

/**
 * Format all slot placements without truncation.
 *
 * @param placements Placement entries for one article.
 * @returns Full placement summary.
 */
export function formatAllArticlePlacements(placements: IArticlePlacement[]): string {
  if (placements.length === 0) {
    return 'Not placed'
  }

  return placements.map((placement) => formatSinglePlacement(placement)).join(', ')
}
