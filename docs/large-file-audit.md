# Large Code File Audit

Audit of the largest source files in the repository, checked against the project
`.cursorrules` (max 30 lines per function, max 4 parameters, single
responsibility). Build artifacts (`frontend/.next`), `node_modules`, and lockfiles
are excluded.

_Last updated: 2026-06-17_

## Ranking by line count (hand-written source)

| Lines | File | Status |
| ----- | ---- | ------ |
| 1172 | `backend/admin_app/seed_dev.py` | Acceptable (mostly static seed data) |
| 515  | `frontend/app/(admin)/admin/editor/page.tsx` | Violation (most severe) |
| 501  | `frontend/components/features/section-page.tsx` | Violation |
| 435  | `frontend/components/ui/masthead.tsx` | Resolved (`Masthead` split into ribbon/nav-bar/action sub-components) |
| 411  | `frontend/components/ui/story-card.tsx` | Violation |
| 640  | `backend/news_storage_app/.../services/article_service.py` | Resolved (validation helpers extracted from `create`/`update`) |
| 347  | `frontend/components/features/homepage-editorial-band.tsx` | Resolved (split into zone components; options-object helper) |
| 315  | `frontend/components/features/homepage.tsx` | Resolved (slot-selection extracted; hero/sections split) |

> Note: `frontend/package-lock.json` (17,372 lines) is an auto-generated lockfile
> and is intentionally excluded.

## Worst offenders

### 1. `frontend/app/(admin)/admin/editor/page.tsx` (most severe)

- `EditorCurationPage` (lines 98-551) is a ~450-line component holding 11
  `useState` hooks plus 7 async handlers.
- Mixes at least four distinct responsibilities: article search/loading, media
  curation, homepage drag-and-drop placement, and publishing.
- `applyDropPlacement` (307-361) is ~54 lines; the JSX return (363-550) is ~190
  lines. Both far exceed the 30-line rule.

### 2. `frontend/components/features/section-page.tsx`

- `HeroBlock` (156-375) is ~219 lines. It both computes article slices (the
  large if/else at 196-231) and renders three columns of JSX — two
  responsibilities, well over 30 lines.
- `SectionPage` (434-527) is ~93 lines.

### 3. `frontend/components/ui/story-card.tsx`

- `StoryCard` (99-313) is ~214 lines — a six-branch variant dispatcher
  (`headline-only`, `text-link`, `compact`, `rail`, `hero-lead`, default) with
  full JSX inline for each variant.
- The small helpers (`StoryThumb`, `StoryTitle`, `StorySummary`) are
  well-factored and are a good model to follow.

### 4. `backend/news_storage_app/.../services/article_service.py` — Resolved

- `create`/`update` now orchestrate small single-responsibility helpers and are
  well under 30 lines: `_prepare_new_article` + `_new_article_doc` for creation;
  `_build_update_doc`, `_check_reporter_permissions`, `_normalize_update_media`,
  `_apply_slug_update`, and `_invalidate_feeds_for_update` for updates.
- `publish`/`archive` reuse `_invalidate_article_feed` and `_write_audit`.
- Remaining note: the public `create`/`update` entrypoints still take 5 keyword
  args each; converting them to options objects would ripple through routers and
  tests, so it's left as a separate, lower-priority change.

### 5. `frontend/components/features/homepage-editorial-band.tsx` — Resolved

- `splitEditorialColumnArticles` moved to `lib/helpers/feed-layout.ts` and now
  takes a single `IEditorialColumnSplitOptions` object (was 5 positional params);
  its tail logic is split into `splitEditorialColumnTail`.
- Shared zone components (`ColumnHeading`, `LeadRailCards`, `CompactSideCards`,
  `HeadlineList`, `RightRailTop`) shrink `EditorialColumn` and `RightRailColumn`
  to well under 30 lines each; `HomepageEditorialBand` is now a guard wrapper
  delegating layout to `EditorialBandColumns`.
- Right-rail slicing extracted to `splitRightRailColumnArticles`.

### 6. `frontend/components/features/homepage.tsx` — Resolved

- Slot-selection logic extracted to `selectHomepageSections` in
  `lib/helpers/feed-layout.ts`, returning a typed `IHomepageSections`;
  `HomepageContent` is now ~20 declarative lines.
- Each module is its own component (`EarlyUsSection`, `TopStoriesSection`,
  `PoliticsSportsSection`, `PostPoliticsSections`, `EditorialBandSections`,
  `GridSections`).
- `HeroBlock` split into `HeroLeftRail`, `HeroCenter` (+ `HeroLead`), and
  `HeroRightRail`.

### 7. `frontend/components/ui/masthead.tsx` — Resolved

- `Masthead` is now a ~30-line layout shell that wires up the scroll/lock hooks
  and delegates rendering to `MastheadAdRibbon` and `MastheadNavBar`.
- The previously inline JSX is split into focused sub-components:
  `MastheadAdRibbon`, `MastheadBrandLink`, `MastheadMobileToggle`,
  `MastheadLanguageSelector`, `MastheadMarketSelector`, `MastheadUtilityBadges`,
  and `MastheadActions` — each well under 30 lines.
- The three near-identical admin shortcuts are data-driven via
  `MASTHEAD_ADMIN_LINKS` rendered through a reusable `MastheadAdminLink`,
  removing the prior copy-paste duplication.

## Large but acceptable

- `backend/admin_app/seed_dev.py` (1,172 lines): ~660 lines (48-712) are static
  `SEED_STORIES` data; the 25 functions below are nearly all under 30 lines. Not
  a function-length violation, but it mixes seed data with seeding logic — a
  candidate to split data into its own module.
- `backend/tests/test_read_layer.py` (290) and
  `frontend/lib/helpers/feed-layout.ts` (248): test/helper files, reasonable.

## Suggested refactor priority

1. `editor/page.tsx` — split the mega-component into focused panels/hooks.
2. `story-card.tsx` — split the six-variant dispatcher into per-variant components.
3. `section-page.tsx` — extract slice logic out of `HeroBlock`.
4. `homepage.tsx` — extract slot-selection logic out of `HomepageContent`. ✅ done
5. `article_service.py` — extract validation helpers from `update`/`create`. ✅ done
6. `homepage-editorial-band.tsx` — break up columns; convert
   `splitEditorialColumnArticles` to an options object. ✅ done
7. `masthead.tsx` — extract the ad ribbon, selectors, and admin links out of
   `Masthead`. ✅ done
