## Plan: Geo Scope Rollout for US/FL/Miami-Dade + PR/San Juan

Deliver region-aware curation and feed switching for the confirmed five scopes (us, us-fl, us-fl-miami-dade, pr, pr-san-juan) across public landing + editor placement/preview, while keeping all existing country/state/county/municipality dropdown options visible and unchanged. Implementation will wire scope selection into regionCode generation, route preview/placement requests by region, and preserve current page/article UI formats.

**Steps**
1. Phase 1 - Scope model alignment (blocks all later steps)
1. Extend shared client scope shape to represent hierarchical selection without removing existing fields: keep market + state/town behavior, add county when US/Florida is selected.
2. Define canonical regionCode builder precedence: county > town/state > market.
3. Keep backward compatibility for existing callers by defaulting missing county to null.

2. Phase 2 - Public landing scope wiring (depends on Phase 1)
1. Update masthead locality selectors so US state + Florida county + PR municipality all update shared market context (instead of local-only county state).
2. Persist/read selected county similarly to existing market/town cookies/localStorage so SSR and client hydration match.
3. Update server-side market/locality resolver to include county and pass regionCode into homepage/section feed fetches.
4. Keep top horizontal nav dropdown inventories intact (no list deletions), only change behavior plumbing.

3. Phase 3 - Editor placement/preview scope wiring (parallel with Phase 2 after Phase 1)
1. Extend editor scope object/storage/query keys to include county and regionCode derivation.
2. Update Editor scope switcher UI to support selecting: USA, Florida, Miami-Dade, Puerto Rico, San Juan via existing market/locality flow plus county selection when applicable.
3. Ensure placement and preview hooks pass regionCode to layout/preview endpoints, including layout lookup for slot operations.
4. Keep page format unchanged in placement preview rendering; only scope target changes.

4. Phase 4 - Backend/contract guardrails (parallel with Phase 2/3)
1. Verify layout and preview endpoints consistently honor region_code when provided and fallback to legacy market/town when not.
2. Confirm region records/layout records exist for us, us-fl, us-fl-miami-dade, pr, pr-san-juan and active layouts resolve through nearest-ancestor fallback.
3. Ensure article placement/publish invalidation remains region-aware for these scopes.

5. Phase 5 - Verification and rollout checks (depends on Phases 2-4)
1. Public flow: selecting each of the five scopes shows the same layout format as current landing page, but feed content can differ by scope.
2. Editor flow: placement changes made in each of the five scopes appear in /admin/preview for the same scope and do not leak unintentionally to unrelated scopes.
3. Article page format remains unchanged when opening stories from any scope.
4. Regression: existing country/state/county/municipality dropdown options still render in masthead.

**Relevant files**
- frontend/components/ui/masthead.tsx - keep dropdown lists intact; wire county/state/town selections into shared context.
- frontend/context/market-context.tsx - add persisted county support and validation for US/Florida county selection.
- frontend/lib/region-code.ts - centralize precedence logic to build regionCode from market + locality + county.
- frontend/lib/market-server.ts - expose server-side locality/county readers for SSR feed requests.
- frontend/lib/graphql/server-fetch.ts - pass computed regionCode for homepage/section SSR.
- frontend/hooks/use-feed.ts - client feed query uses regionCode from full scope.
- frontend/hooks/use-page-feed.ts - page feed query uses regionCode from full scope.
- frontend/lib/editor/editor-scope.ts - extend editor scope model with county/locality support.
- frontend/lib/editor/editor-scope-storage.ts - persist/broadcast expanded scope safely.
- frontend/lib/editor/query-keys.ts - include county/regionCode dimensions in cache keys.
- frontend/components/features/editor-scope-switcher.tsx - add UI controls for state/county/municipality targeting in editor.
- frontend/hooks/use-homepage-placement-editor.ts - pass regionCode into layout lookups/publish operations.
- frontend/hooks/use-editor-preview-feed.ts - pass regionCode for preview + slot layout fetches.
- frontend/lib/api/layout-client.ts - accept and forward regionCode consistently for layout/preview/publish endpoints.
- backend/layout_admin_app/layout_admin_app/routers/layouts.py - verify region_code handling for page layout and preview feed.
- backend/shared/shared/read/layout_reads.py - nearest-ancestor fallback behavior for region layout selection.
- backend/shared/shared/read/site_reads.py - region-scoped article query behavior.

**Verification**
1. API checks (manual): call preview/layout endpoints with each region code and confirm non-empty or expected fallback layout resolution.
2. UI checks (public): select USA, Florida, Miami-Dade, Puerto Rico, San Juan in masthead and confirm feed changes by scope while structure/format stays identical.
3. UI checks (editor): for each target scope, place a story in hero from placement page and confirm preview page reflects only that scope.
4. Regression checks: verify all market/state/county/municipality dropdown options remain present in masthead and no options were removed.
5. Cache checks: after placement publish in each scope, confirm latest content appears without stale region cross-talk.

**Decisions**
- Include both editor and public landing behavior now (not editor-only).
- Keep full dropdown inventories; do not reduce options to only five entries.
- Canonical target codes for guaranteed support in this phase: us, us-fl, us-fl-miami-dade, pr, pr-san-juan.
- Existing landing page and article page formats remain unchanged; only scope-specific content routing changes.

**Further considerations**
1. Unsupported scope handling recommendation: if selected scope lacks direct layout, use current nearest-ancestor fallback and surface no user-facing error.
2. Data readiness recommendation: ensure placements exist at region scopes where dedicated content is expected; otherwise inherited parent content is expected behavior.
3. Feature flag recommendation: keep region read/GraphQL arg flags enabled in environments where this rollout is tested to avoid mixed path confusion.
