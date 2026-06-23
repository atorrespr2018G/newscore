# Editor: Professional-Readiness Evaluation and Recommendations

## Scope examined

- Page shell: [frontend/app/(admin)/admin/editor/page.tsx](<frontend/app/(admin)/admin/editor/page.tsx>)
- Orchestration hook: [frontend/hooks/use-editor-curation.ts](frontend/hooks/use-editor-curation.ts)
- Story pool: [frontend/components/features/editor-story-pool.tsx](frontend/components/features/editor-story-pool.tsx)
- Detail panel: [frontend/components/features/editor-article-detail-panel.tsx](frontend/components/features/editor-article-detail-panel.tsx)
- Placement canvas: [frontend/components/features/homepage-placement-canvas.tsx](frontend/components/features/homepage-placement-canvas.tsx)
- Helpers: [frontend/lib/helpers/editor-curation.ts](frontend/lib/helpers/editor-curation.ts), [frontend/context/editor-scope-context.tsx](frontend/context/editor-scope-context.tsx)
- Existing-but-unused preview: [frontend/components/features/homepage-preview-pane.tsx](frontend/components/features/homepage-preview-pane.tsx), [frontend/hooks/use-editor-preview-feed.ts](frontend/hooks/use-editor-preview-feed.ts)

Overall: clean, well-factored code that follows the repo conventions (small functions, docstrings, typed errors, optimistic + rollback). The gaps are about scale, professional UX polish, and missing newsroom capabilities — not broken logic.

## Tier 1 - Production blockers (do first)

- **Stop loading the whole archive client-side.** `fetchAllPaginatedArticles` in [frontend/lib/helpers/editor-curation.ts](frontend/lib/helpers/editor-curation.ts) loops `while (true)` over 200-item pages on mount and after every mutation. Replace with server-driven pagination/filtering: keep one visible page in state, push status/placement/category/date filters into the `articles`/`search` query params, and lazy-load more on scroll. Target: bounded memory regardless of archive size.
- **Reduce full refetch on every write.** `saveArticleChanges` / `publishSelected` / placement mutations all call `reloadArticles()` (full pool) plus `loadHomepageSlots` + `loadArticlePlacements`. Update the single changed row in place (already returned by PATCH/publish) instead of refetching everything; only refresh slots/placements that changed.
- **Batch media loading.** `loadArticleMedia` issues one `getMediaById` per id via `Promise.all`. Add/Use a `getMediaByIds(ids)` batch call to avoid request fan-out on every selection.

## Tier 2 - Professional polish (high value, moderate effort)

- **Wire in the WYSIWYG preview that already exists.** Implement the Placement/Preview toggle from [.cursor/plans/editor-canvas-preview.md](.cursor/plans/editor-canvas-preview.md) in `EditorWorkspaceColumn`: a segmented control switching between `HomepagePlacementCanvas` and `HomepagePreviewPane` (fed by `useEditorPreviewFeed`). This is the biggest single value add and most of the parts are built.
- **Localize the placement canvas.** [frontend/components/features/homepage-placement-canvas.tsx](frontend/components/features/homepage-placement-canvas.tsx) hardcodes English ("Homepage placement canvas", "Empty target", "Occupied:", "Draft", "Remove", arrow labels, aria-labels). Move all to `useTranslations('admin')` under an `editor.canvas.*` namespace to match the rest of the page.
- **Unsaved-changes guard.** The detail panel mutates `mediaItems` / `selectedCategoryIds` / `internationalPotential` in local state; selecting another card or navigating away discards them silently. Track a dirty flag and warn (or autosave) before switching selection or route.
- **Toast/notification system.** `EditorStatusMessages` renders a single persistent banner. Replace with transient, stackable toasts so multiple results (e.g., "placed" + "auto-published") are visible and auto-dismiss.
- **Loading skeletons.** Replace the plain `editor.loading` text with skeleton cards/canvas to reduce perceived latency.

## Tier 3 - Accessibility and interaction quality

- **Announce placement results to assistive tech.** Add an `aria-live` region tied to placement mutation messages on the canvas (the page-level status is far from the drop action).
- **Touch + pointer DnD.** Native HTML5 drag-and-drop has no touch support and no custom drag image. Consider a pointer-based DnD lib (e.g. dnd-kit) for mobile/tablet newsroom use and better keyboard reordering.
- **Replace unicode arrow buttons** ("up/down") with proper icon buttons + labels for consistent rendering and clearer affordances.

## Tier 4 - Newsroom capabilities (most "valuable" upside)

- **Scheduled publishing** (publish/place at a future time) - core newsroom feature; currently only immediate publish exists.
- **Version history / audit trail** - who placed/removed/published what and when. The optimistic mutations already centralize writes in `runPlacementMutation`, a natural hook point.
- **Collaboration safety** - two editors can clobber the same homepage pins. Add conflict detection (ETag/`updated_at` check on slot PATCH) and a visible "edited by" indicator.
- **Multi-market / multi-page editing in-app.** `editor-scope-context` already supports `setScope`, but the UI hardcodes the homepage and has no scope switcher. Surface a market/page selector to unlock world-page and per-market curation.
- **Bulk operations** - multi-select stories to place/unplace/publish together.

## Suggested sequencing

1. Tier 1 scale fixes (pagination, targeted refresh, batch media).
2. Preview toggle + canvas i18n (Tier 2 headline items).
3. Unsaved-changes guard + toasts + skeletons.
4. Accessibility pass (aria-live, touch DnD).
5. Newsroom features (scheduling, audit, collaboration) as roadmap items.

## Notes

- This is an evaluation/roadmap; no code has been changed. Each tier can be split into its own implementation plan/PR. Recommend starting with Tier 1 item 1 (pagination) since it is the clearest production blocker and unblocks everything that refetches the pool.
