---
name: Code Quality Compliance Audit
overview: 'Audit the repository against the project's good-practice rules: helpers, components/services, small functions/modules, naming, docstrings/JSDoc, tests, CI, and generated artifact hygiene. The codebase has a solid foundation, but it is only partially compliant because several high-impact modules and routes violate SRP, test coverage is uneven, and CI does not enforce all shipped behavior.'
todos:
  - id: fix-backend-routes
    content: Fix reporter route pagination, reporter bio ownership, and search authorization/status exposure.
    status: completed
  - id: clean-generated-artifacts
    content: Update ignore rules and remove generated build artifacts from version control.
    status: completed
  - id: harden-ci
    content: Add missing frontend build/i18n/test and backend lint/typecheck gates to CI.
    status: completed
  - id: add-frontend-tests
    content: Introduce a frontend unit test runner and cover pure helpers first.
    status: completed
  - id: split-large-modules
    content: Refactor `use-editor-curation.ts` and `article_service.py` into smaller helpers/services.
    status: completed
  - id: dedupe-routes
    content: Consolidate legacy and locale public-site routes around shared components.
    status: completed
  - id: add-error-boundaries
    content: Add Next.js error boundaries and shared loading/error/empty-state components.
    status: completed
  - id: centralize-types-constants
    content: Move domain types/constants out of UI modules and remove duplicated helpers.
    status: completed
---

# Code Quality Compliance Audit

## Overall Assessment

The repository is **partially compliant** with the good-practice design rules. The strongest areas are the backend router/service pattern, shared exception infrastructure, frontend helper/API layering, strict TypeScript, and clear repo boundaries. The main compliance gaps are oversized modules, missing frontend tests, incomplete CI gates, duplicated route trees, generated artifacts in git, and a few backend route/security issues.

## Highest-Priority Findings

- **Backend runtime/security issues should be fixed first.** `[backend/admin_app/admin_app/routers/reporters.py](backend/admin_app/admin_app/routers/reporters.py)` calls `user_service.list_users(db)` without the required pagination argument and then treats the returned tuple as a flat list. The same file lets any reporter update any reporter bio because the route accepts `admin`, `editor`, and `reporter` without checking ownership. `[backend/news_storage_app/news_storage_app/routers/search.py](backend/news_storage_app/news_storage_app/routers/search.py)` exposes `/search` without auth while exact `article_id` lookup explicitly matches across all statuses.

- **Large modules violate SRP and make safe change harder.** `[frontend/hooks/use-editor-curation.ts](frontend/hooks/use-editor-curation.ts)` is a large mixed hook that combines API calls, validation, media loading, placement board state, and pure helpers. `[backend/news_storage_app/news_storage_app/services/article_service.py](backend/news_storage_app/news_storage_app/services/article_service.py)` centralizes validation, workflow, media handling, slug behavior, cache invalidation, and audit. These should be split into smaller helpers/services following existing patterns.

- **Frontend has no automated tests.** `[frontend/package.json](frontend/package.json)` has `lint`, `codegen`, `typecheck`, and `validate-i18n`, but no test script or test runner. There are no `*.test.ts` or `*.test.tsx` files under `[frontend](frontend)`, despite many pure helpers that are good unit-test targets.

- **CI does not fully protect production behavior.** `[.github/workflows/ci.yml](.github/workflows/ci.yml)` runs frontend lint/codegen/typecheck and backend pytest, but skips `npm run build`, skips `npm run validate-i18n`, has no frontend tests, has no backend lint/typecheck, and the integration job is currently an `echo` stub.

- **Generated artifacts and ignore rules need cleanup.** `[.gitignore](.gitignore)` ignores `.next`, caches, `node_modules`, and Python cache files, but misses `*.tsbuildinfo`, `*.egg-info/`, coverage outputs, and local env variants. `frontend/tsconfig.tsbuildinfo` and `backend/shared/newscore_shared.egg-info/*` appear as tracked/generated artifacts.

- **Duplicated frontend route trees increase drift.** `[frontend/app/(site)](frontend/app/(site))` and `[frontend/app/[locale]/(site)](frontend/app/[locale]/(site))` contain parallel public-site routes. The legacy article UI diverges from the localized shared article reading view, and layouts are duplicated.

- **Error handling is inconsistent at the app boundary.** There are no `error.tsx` or `global-error.tsx` files under `[frontend/app](frontend/app)`, even though the project rule expects API errors to surface through a global error boundary. Several components/hooks handle loading/error states locally and inconsistently.

- **Types and helpers are sometimes in the wrong layer.** `IEditorStoryRow` is exported from `[frontend/components/features/editor-story-pool.tsx](frontend/components/features/editor-story-pool.tsx)` and imported by helpers/hooks, which couples domain/editor logic to a UI component. Some duplicated helpers and union types also live inline instead of in `interfaces/` or `lib/helpers/`.

## Remediation Plan

1. **Fix correctness and authorization issues.** Update reporter listing to use pagination or a dedicated service method, move role filtering into `user_service`, enforce reporter bio ownership, and decide whether `/search` is authenticated or limited to published-safe results for unauthenticated callers.

2. **Harden repository hygiene and CI.** Extend `[.gitignore](.gitignore)`, untrack generated build artifacts, add frontend `build` and `validate-i18n` to CI, add a real frontend test command once a runner exists, and replace the integration `echo` job with an executable check or remove it until it is real.

3. **Introduce frontend test infrastructure.** Add a lightweight unit test runner, then start with pure helpers: feed layout, article sanitization/chunking, editor placement mutations, article media helpers, and GraphQL mappers.

4. **Split the largest modules along existing boundaries.** Break `[frontend/hooks/use-editor-curation.ts](frontend/hooks/use-editor-curation.ts)` into focused hooks and helper modules. Split `[backend/news_storage_app/news_storage_app/services/article_service.py](backend/news_storage_app/news_storage_app/services/article_service.py)` into validation, media, workflow, and persistence orchestration modules.

5. **Converge duplicated frontend routes and shared UI.** Decide whether locale routes are now canonical. If yes, redirect/remove the legacy `(site)` routes and reuse `[frontend/components/features/article-reading-view.tsx](frontend/components/features/article-reading-view.tsx)` instead of maintaining separate article UIs.

6. **Add app-level error boundaries and shared states.** Add frontend `error.tsx` / `global-error.tsx` and shared loading/error/empty-state components for feed and article pages.

7. **Move domain types and constants to stable layers.** Move editor row/domain types out of UI components, centralize article status constants, reuse collection/time helpers, and remove duplicated local helpers.

8. **Backfill docstrings/JSDoc and enforce conventions gradually.** Prioritize public backend services with weak docstrings, public hooks/components with missing JSDoc, and lint rules or review checks that can enforce the most important conventions without blocking generated code.
