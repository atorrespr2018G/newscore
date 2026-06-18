# NewsCore Platform — Implementation Plan

News platform designed for AI-assisted development in Cursor.

## Session Status Notes

- Baseline verified (Jun 7, 2026): top ad ribbon + top horizontal nav behavior is working as intended with the 2s initial lock and synchronized hide/reveal flow.
- Safety marker: treat this as a known-good checkpoint before additional header/scroll behavior changes.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · React Query |
| Backend | Python 3.12 · FastAPI (3 editorial REST apps + GraphQL subgraphs) |
| Database | MongoDB (Motor async driver) |
| Cache | Redis (`redis.asyncio`) |
| Auth | JWT (`python-jose`) · role-based access |
| Media | Local filesystem (dev) → S3-ready interface |
| Gateway | Nginx · Docker Compose |

## Architecture Summary

- **Admin App (5001)**: users, reporters, roles, audit logs. Only service that issues JWT tokens.
- **News Storage App (5002)**: articles, media upload, tags, categories, search; write operations require reporter/editor.
- **Layout Admin App (5003)**: page layouts, slots, widget rules; enables editors to configure the homepage without code changes.
- **GraphQL stack (4000 + subgraphs)**: federated public reads (`homepageFeed`, `articleBySlug`, search, breaking news); replaces the retired delivery REST service.
- **Shared package (`backend/shared/`)**: infrastructure + data contracts used by all apps; no business logic.

## Monorepo Layout (target)

```text
newscore/
├── .cursorrules
├── IMPLEMENTATION_PLAN.md
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── frontend/
│   ├── .cursorrules
│   ├── app/
│   ├── components/ui/
│   ├── components/features/
│   ├── hooks/
│   ├── lib/api/
│   ├── lib/helpers/
│   ├── interfaces/
│   └── tests/
├── backend/
│   ├── .cursorrules
│   ├── shared/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── shared/            # python package root
│   ├── admin_app/
│   ├── news_storage_app/
│   ├── layout_admin_app/
│   └── subgraphs/
└── media/
    ├── images/
    └── videos/
```

## Contracts and Shared Infrastructure (`backend/shared/`)

The shared package is installed into each app via:

- Development: `pip install -e /shared` (container command in `docker-compose.yml`)

Responsibilities:

- **`core/db.py`**: Motor client lifecycle and `get_db()` dependency.
- **`core/auth.py`**: JWT creation/verification + `get_current_user()` + `require_role()`.
- **`core/exceptions.py`**: domain exception hierarchy for services (routers translate to HTTP).
- **`core/file_storage.py`**: dev local file store API: `save_image()`, `save_video()`, `delete_media_file()`.
- **`core/pagination.py`**: `PaginationParams` and `get_pagination()`.
- **`core/logger.py`**: consistent structured logging.
- **`core/constants.py`**: environment-driven constants (max file size, algorithms, etc.).
- **`models/`**: MongoDB document models (Pydantic).
- **`schemas/`**: request/response schemas (safe DTOs).

## Backend App Responsibilities

### Admin App (5001)

- `POST /auth/login`: verify password hash; issue JWT.
- `POST /users`, `GET /users`, `PATCH /users/{id}`, `DELETE /users/{id}`
- `GET /roles`, `POST /users/{id}/role`
- `GET /audit-logs` (admin only)

### News Storage App (5002)

- Article lifecycle: draft → review → published → archived
- CRUD + `POST /articles/{id}/publish`, `POST /articles/{id}/archive`
- Media ingestion: `POST /media/image`, `POST /media/video`, `DELETE /media/{id}`
- Category CRUD; tags list; full-text search endpoint

### Layout Admin App (5003)

- Layout CRUD (one per page name)
- Slot CRUD within layout; slot assignment: pinned IDs or dynamic query rules
- Widgets: breaking ticker, featured video
- Preview endpoint to resolve layout rules to article lists

### Delivery App (5004)

Public read-only endpoints (Redis-cached):

- `GET /feed`
- `GET /articles/{slug}`
- `GET /category/{slug}` (paginated)
- `GET /search?q=`
- `GET /breaking`

## Frontend (Next.js)

Routes:

- `/`: homepage (layout-driven)
- `/[category]`: category list
- `/article/[slug]`: article detail
- `/search`: search results
- `/admin/*`: admin dashboard (protected)
- `/reporter/*`: reporter portal

Component rules:

- `components/ui/`: presentational only (no data fetching)
- `components/features/`: data-connected via hooks; composes UI components

Data fetching chain:

hook → typed API client (`lib/api/*`) → `fetch()` → typed interfaces (`interfaces/`)

## MongoDB Collections (target)

- `users`, `articles`, `media`, `categories`, `layouts`, `slots`, `comments`, `audit_logs`

Required indexes:

- `articles`: `{ slug: 1 }` unique, `{ status: 1, published_at: -1 }`, text index on `title` + `body`
- `users`: `{ email: 1 }` unique
- `media`: `{ uploader_id: 1, created_at: -1 }`
- `audit_logs`: `{ user_id: 1, timestamp: -1 }`
- `categories`: `{ slug: 1 }` unique

## Implementation Phases (execution order)

1. **Foundation**: compose/nginx/env + shared package scaffolding + base app skeletons
2. **Admin App**: auth + users/roles + audit logs
3. **News Storage App**: articles + media + categories/tags + search
4. **Layout Admin App**: layouts/slots/widgets + preview
5. **Delivery App**: read-only API + Redis caching
6. **Frontend**: interfaces + clients + hooks + UI/features + pages
7. **Polish & Testing**: tests, performance, security hardening, docs

