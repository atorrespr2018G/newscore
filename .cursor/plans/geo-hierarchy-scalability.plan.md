# Geo Hierarchy Scalability Implementation Plan

## Goal

Implement variable-depth geographic publishing and reads for region structures like Country -> State/Province -> County/Town/City, while supporting high-cardinality region+category pages with predictable performance and safe rollout.

## Scope

In scope:
1. Region hierarchy data model and APIs.
2. Article targeting and inheritance rules.
3. Layout/feed resolution by region and page.
4. GraphQL/REST contract evolution.
5. Indexing, caching, invalidation, and migration.
6. Tests, observability, rollout, and rollback.

Out of scope (separate plan):
1. UI redesign for admin region editors.
2. Fine-grained editorial RBAC model changes.
3. Relevance ranking/ML personalization.

## Current Baseline (Confirmed)

1. Markets are flat records without hierarchy metadata.
2. Articles use market_ids and optional town_id.
3. Layout resolution is market_id + page_name.
4. Feed cache keys are page+market+town and invalidation relies on Redis scan patterns.
5. Existing indexes are not sufficient for deep region inheritance and high-cardinality region/category reads.

## Target Architecture Decisions

1. Hierarchy source of truth: adjacency list.
2. Read optimization: denormalized ancestors and path (materialized path hybrid).
3. Article targeting: direct_region_ids plus effective_region_ids.
4. Category remains independent taxonomy.
5. Layout scope: region-specific with ancestor fallback.
6. Rollout mode: dual-write and dual-read with feature flags.

## Data Model Changes

### 1) New Collection: regions

Document shape:

```json
{
	"_id": "uuid",
	"code": "us-ca-sf",
	"name": "San Francisco",
	"kind": "city",
	"parent_id": "uuid-of-california",
	"ancestor_ids": ["uuid-world", "uuid-us", "uuid-california"],
	"depth": 3,
	"path": "world/us/us-ca/us-ca-sf",
	"country_code": "us",
	"is_active": true,
	"default_locale": "en-US",
	"labels": {
		"en": "San Francisco",
		"es": "San Francisco"
	},
	"created_at": "ISO-8601",
	"updated_at": "ISO-8601"
}
```

Rules:
1. kind enum: world, country, state, province, county, city, town, municipality, district.
2. parent_id nullable only for world root.
3. ancestor_ids ordered root to parent.
4. path unique and immutable except controlled move operation.

### 2) Article Schema Extension

Add fields:
1. direct_region_ids: list of editor-selected regions.
2. effective_region_ids: expanded visibility set used for reads.
3. region_visibility_mode: upward_only | explicit_only | custom.
4. primary_region_id: optional for canonical locality.

Backward compatibility fields retained during migration:
1. market_ids
2. town_id

### 3) Layout Schema Extension

Add fields:
1. region_id: required new scope owner.
2. scope_mode: exact | inherit_from_ancestor.
3. inherit_depth_limit: optional integer.

Legacy support:
1. market_id temporarily retained.

## Inheritance and Visibility Policy

Default rule for region_visibility_mode=upward_only:
1. If article tagged to city/town, it is visible in that region and all ancestors up to world.
2. If tagged to county/state/country, visible in that level and its ancestors.
3. No automatic downward distribution to descendants.

Optional custom rule:
1. Editors may add extra direct_region_ids for cross-region syndication.

Effective region computation:
1. effective_region_ids = direct_region_ids UNION all ancestors(direct_region_ids).

## API Contract Changes

### GraphQL

Update site feed query:

```graphql
query HomepageFeed($regionCode: String!, $pageName: String = "homepage", $categorySlug: String) {
	homepageFeed(regionCode: $regionCode, pageName: $pageName, categorySlug: $categorySlug) {
		layoutId
		pageName
		slots {
			id
			positionKey
			displayName
			presentationType
			contentType
			articles {
				id
				slug
				title
				publishedAt
			}
		}
	}
}
```

Compatibility period:
1. Keep market/town args and map to regionCode internally.
2. Add deprecation annotations after rollout completion.

### REST (Admin)

Article create/update:
1. Accept direct_region_ids and region_visibility_mode.
2. Server computes effective_region_ids.

Layout create/update:
1. Accept region_id.
2. Optional inherit controls.

Region APIs:
1. GET /regions?parent_id=...
2. GET /regions/{id}
3. POST /regions
4. PATCH /regions/{id}
5. POST /regions/{id}/move (controlled re-parent with recompute)

## Read Path Algorithms

### Layout Resolution

Input: region_id, page_name

Algorithm:
1. Try exact active layout for region_id+page_name.
2. If not found, walk ancestors nearest-to-farthest and select first active layout.
3. Cache resolved layout source region.

### Slot Article Resolution

Input: slot.query_rule, requested_region_id, page context

Query base:
1. status=published
2. effective_region_ids includes requested_region_id
3. Optional category filter from query_rule
4. Sort by published_at desc (or configured sort)

Pinned semantics:
1. Keep existing pinned-first behavior.
2. Fill remaining capacity via query rule.

## Index Plan

Create indexes in ensure_indexes with explicit names:

regions:
1. {code: 1} unique
2. {path: 1} unique
3. {parent_id: 1, is_active: 1}
4. {ancestor_ids: 1, is_active: 1}
5. {country_code: 1, kind: 1, is_active: 1}

articles:
1. {status: 1, published_at: -1}
2. {effective_region_ids: 1, status: 1, published_at: -1}
3. {effective_region_ids: 1, category_ids: 1, status: 1, published_at: -1}
4. {direct_region_ids: 1, updated_at: -1}
5. keep {slug: 1} unique

layouts:
1. {region_id: 1, page_name: 1, is_active: 1}
2. keep legacy {page_name: 1, market_id: 1, is_active: 1} during migration

slots:
1. {layout_id: 1, order_index: 1}

cache bookkeeping (new optional collection):
1. feed_cache_keys: {region_code: 1, page_name: 1}

## Caching and Invalidation Strategy

### New Cache Key

Format:
1. graphql:homepageFeed:{page}:{region_code}:{category_slug_or_underscore}:v{region_version}

Notes:
1. region_version increments on layout/article changes affecting that region.
2. Prefer version bump over key scans.

### Invalidation

On article publish/update:
1. Determine impacted region codes from effective_region_ids.
2. Increment region version counters for impacted page scopes.

On layout/slot updates:
1. Increment version for target region and descendants that inherit this layout.

## Single-Team Serial Execution Plan

Execution rule:
1. One team executes phases in strict order.
2. No parallel phase work.
3. Do not start next phase until prior phase exit criteria pass.

### Phase 0: Setup and Controls (Week 1)

Entry criteria:
1. Main branch green.
2. Staging environment available.

Tasks:
1. Add feature flags:
   1. GEO_REGIONS_ENABLED
   2. GEO_DUAL_WRITE_ENABLED
   3. GEO_READ_FROM_REGIONS
   4. GEO_GRAPHQL_REGION_ARGS
2. Add region model/repository skeletons and migration script structure.
3. Add plan tracking checklist and phase sign-off template in this file.

Deliverables:
1. Feature flags wired and default-off in all environments.
2. Migration scripts folder and templates created.
3. PR merged with no behavior change.

Exit criteria:
1. Existing tests pass unchanged.
2. Flags can be toggled at runtime without restart (or documented restart requirement).

### Phase 1: Schema and Dual-Write Foundation (Week 2)

Entry criteria:
1. Phase 0 exit criteria complete.

Tasks:
1. Extend schemas/models for region fields in articles/layouts.
2. Add new indexes for regions/articles/layouts/slots.
3. Implement dual-write logic in article and layout write services.
4. Keep legacy fields and read paths untouched.

Files to modify:
1. backend/shared/shared/models/article.py
2. backend/shared/shared/models/layout.py
3. backend/shared/shared/schemas/article_schemas.py
4. backend/shared/shared/schemas/layout_schemas.py
5. backend/shared/shared/core/indexes.py
6. backend/news_storage_app/news_storage_app/services/article_create_service.py
7. backend/news_storage_app/news_storage_app/services/article_update_service.py
8. backend/layout_admin_app/layout_admin_app/services/layout_service.py

Deliverables:
1. Dual-write enabled behind GEO_DUAL_WRITE_ENABLED.
2. Backward-compatible API contract.

Exit criteria:
1. New fields written when flag on.
2. Legacy behavior identical when flag off.
3. Unit tests for dual-write pass.

### Phase 2: Backfill and Data Reconciliation (Week 3)

Entry criteria:
1. Phase 1 merged and deployed to staging.

Tasks:
1. Build canonical region tree (world, countries, subdivisions).
2. Map markets to country regions.
3. Map town_id values to region nodes.
4. Backfill direct_region_ids and effective_region_ids.
5. Backfill layout.region_id from market_id.
6. Generate reconciliation outputs (counts, mismatches, unresolved mappings).

Deliverables:
1. Repeatable backfill script with dry-run mode.
2. Reconciliation report artifact committed to rollout notes.

Exit criteria:
1. 100 percent of active articles have effective_region_ids.
2. 100 percent of active layouts have region_id.
3. Unresolved mapping count equals 0 or approved exceptions list.

### Phase 3: Read Path and GraphQL Cutover (Week 4)

Entry criteria:
1. Phase 2 reconciliation approved.

Tasks:
1. Implement region-aware layout fallback resolver.
2. Implement region-aware article read filters.
3. Add GraphQL regionCode args with compatibility adapter for market/town.
4. Add versioned cache key and non-scan invalidation.

Files to modify:
1. backend/shared/shared/read/site_reads.py
2. backend/shared/shared/read/layout_reads.py
3. backend/subgraphs/site_subgraph/site_subgraph/types.py
4. backend/subgraphs/content_subgraph/content_subgraph/types.py
5. backend/shared/shared/core/cache.py
6. backend/shared/shared/core/cache_invalidation.py

Deliverables:
1. New read path behind GEO_READ_FROM_REGIONS.
2. GraphQL region args behind GEO_GRAPHQL_REGION_ARGS.

Exit criteria:
1. Contract tests pass for legacy and new args.
2. Feed p95 regression <= 15 percent in staging load tests.
3. Cache invalidation works without key scan dependency.

### Phase 4: Admin API and Seed Alignment (Week 5)

Entry criteria:
1. Phase 3 canary stable for 48 hours.

Tasks:
1. Add/complete region admin endpoints.
2. Update seed scripts to create region-aware demo data.
3. Update editorial write endpoints to accept direct_region_ids.
4. Update frontend API clients to send region payloads.

Files to modify:
1. backend/admin_app/seed_dev.py
2. backend/news_storage_app/news_storage_app/routers/articles.py
3. backend/layout_admin_app/layout_admin_app/routers/layouts.py
4. frontend hooks and API clients that currently send market/town only.

Deliverables:
1. End-to-end authoring and feed read by region in staging.
2. Updated developer docs for new request payloads.

Exit criteria:
1. Manual QA passes city, county, state, country, world flows.
2. No blocking contract issues for admin or frontend flows.

### Phase 5: Deprecation and Cleanup (Week 6)

Entry criteria:
1. Phase 4 production soak complete.

Tasks:
1. Remove legacy read dependence on market_ids and town_id.
2. Mark old GraphQL args deprecated, then remove after window.
3. Remove obsolete indexes after usage verification.
4. Finalize docs, runbooks, and troubleshooting notes.

Deliverables:
1. Legacy path retirement PR.
2. Post-migration architecture doc updates.

Exit criteria:
1. No traffic on deprecated paths for agreed window.
2. All production SLOs pass for 7 consecutive days.

## Rollout and Rollback

Rollout sequence:
1. Deploy code with flags off.
2. Enable GEO_DUAL_WRITE_ENABLED in staging and validate parity.
3. Run backfill and reconciliation.
4. Enable GEO_READ_FROM_REGIONS for staging canary.
5. Enable GEO_GRAPHQL_REGION_ARGS for staging clients.
6. Repeat staged rollout in production by percentage ramp: 5, 25, 50, 100.

Rollback:
1. Disable GEO_READ_FROM_REGIONS.
2. Keep dual-write on to preserve forward data.
3. Disable GEO_GRAPHQL_REGION_ARGS if client incompatibility appears.
4. Revert API surface only if contract regression persists.

## Test Plan

### Unit Tests

1. Region ancestor expansion logic.
2. Effective region computation for each visibility mode.
3. Layout fallback ancestor selection.
4. Cache key generation and version bump logic.

### Integration Tests

1. Feed resolution for city, county, state, country, world.
2. Mixed pinned and query-filled slots under region filters.
3. Legacy market/town requests return equivalent results during compatibility mode.

### Data Migration Tests

1. Dry-run backfill against snapshot.
2. Reconciliation checks: counts and random-sample record parity.

### Performance Tests

1. Feed read p50/p95/p99 under representative region+category fan-out.
2. Cache invalidation latency under burst publish events.
3. Index explain plans for primary queries.

## Observability and SLOs

Metrics:
1. feed_read_latency_ms by region depth and page.
2. cache_hit_ratio by page and region.
3. layout_fallback_depth distribution.
4. invalidation_duration_ms.
5. dual_write_mismatch_count.

SLO targets:
1. homepageFeed p95 <= 250 ms at steady state.
2. Cache invalidation propagation <= 5 s.
3. Error rate < 0.5 percent for feed endpoints.

## Single-Team Delivery Cadence

1. Week 1: Phase 0 setup and controls.
2. Week 2: Phase 1 schema and dual-write foundation.
3. Week 3: Phase 2 backfill and reconciliation.
4. Week 4: Phase 3 read and GraphQL cutover.
5. Week 5: Phase 4 admin and seed alignment.
6. Week 6: Phase 5 deprecation and cleanup.

## Phase Sign-off Template

For each phase record:
1. Start date.
2. End date.
3. Owner.
4. PR links.
5. Exit criteria evidence.
6. Risks found.
7. Go or no-go decision.

## Plan Tracking Checklist

Use this checklist as the single execution tracker during implementation.

### Global Readiness

- [ ] Feature flags exist in runtime config and default to off.
- [ ] Index creation scripts are idempotent in staging and production.
- [ ] Region tree seed source is approved (country/subdivision reference dataset).
- [ ] Backfill dry-run completed on production-like snapshot.
- [ ] Reconciliation report reviewed and signed by product + engineering.
- [ ] Load test baseline captured before read cutover.
- [ ] Rollback runbook tested in staging.

### Phase Gates

- [ ] Phase 0 signed off.
- [ ] Phase 1 signed off.
- [ ] Phase 2 signed off.
- [ ] Phase 3 signed off.
- [ ] Phase 4 signed off.
- [ ] Phase 5 signed off.

### Contract and Client Migration

- [ ] GraphQL regionCode path available for all site feed consumers.
- [ ] Compatibility adapter validated for legacy market/town callers.
- [ ] Frontend clients migrated to send region payloads for admin writes.
- [ ] Deprecated GraphQL args carry schema deprecation metadata.
- [ ] Contract tests cover both new and legacy argument sets.

### Observability Readiness

- [ ] Dashboards include latency by region depth and fallback depth.
- [ ] Alerts configured for p95 latency, error rate, invalidation delay.
- [ ] Dual-write mismatch metric visible and alert threshold defined.
- [ ] Log fields include request region_code and resolved layout source region.

## Go/No-Go Criteria Per Environment

Staging go criteria:
1. All phase exit criteria satisfied through current phase.
2. No Sev-1/Sev-2 defects open for region reads/writes.
3. p95 regression within budget and cache hit ratio not degraded beyond threshold.
4. Reconciliation mismatch count is 0 or explicitly waived.

Production go criteria:
1. Staging canary stable for agreed soak window.
2. On-call schedule and rollback owner assigned for rollout window.
3. Dashboard and alert checks green for 24 hours pre-rollout.
4. Client compatibility confirmation from frontend and API consumers.

No-go triggers:
1. Feed error rate exceeds SLO for more than 10 minutes.
2. Cache invalidation lag exceeds 5 seconds sustained.
3. Dual-write mismatch spikes above agreed threshold.
4. Any data integrity issue affecting publication visibility.

## Risk Register (Initial)

1. Risk: Incorrect region mapping during backfill causes under/over-distribution.
	Mitigation: dry-run, sampled manual verification, mismatch report, exception list approval.
2. Risk: Ancestor fallback increases query cost at depth spikes.
	Mitigation: indexed ancestor/path fields, cached resolved layout source, load-test gates.
3. Risk: Legacy clients rely on old market/town semantics edge cases.
	Mitigation: compatibility adapter, dual-arg contract tests, phased deprecation window.
4. Risk: Invalidation fan-out is too large for burst publish workflows.
	Mitigation: version counters, bounded descendant updates, instrumentation and alerts.

## Dependency and Decision Log

Record decisions inline as the rollout progresses.

1. Region canonical code format approved: pending.
2. Country/subdivision source dataset approved: pending.
3. Deprecation window length for market/town args approved: pending.
4. Maximum allowed fallback depth override policy approved: pending.
5. Exception process for unresolved legacy mapping approved: pending.

## Definition of Done

1. Region hierarchy supports variable depth with validated ancestor chains.
2. Feed and category reads operate by region with required inheritance semantics.
3. Performance and reliability SLOs are met under projected load.
4. Legacy compatibility window is completed and deprecation notices are documented.
5. Runbooks and architecture docs are updated.
