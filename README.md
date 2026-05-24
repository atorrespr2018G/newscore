# NewsCore (Newscore)



Full-stack news platform:



- **Frontend**: Next.js 14 on `http://localhost:3000`

- **GraphQL (public reads)**: Apollo Router on `http://localhost:4000/graphql` (also `http://localhost/graphql` via Nginx)

- **Gateway**: Nginx on `http://localhost` (routes `/graphql` and `/api/v1/*` to services)

- **Admin API**: FastAPI `http://localhost:5001/docs`

- **News Storage API**: FastAPI `http://localhost:5002/docs`

- **Layout Admin API**: FastAPI `http://localhost:5003/docs`

- **Site subgraph (health)**: `http://localhost:5013/health` — liveness probe for the federated `site` service (`homepageFeed`, `breakingNews`). Docker Compose waits for this (and the other subgraph `/health` endpoints) before starting Apollo Router; if the homepage shows “Failed to load” from `site`, check this URL returns `{"status":"ok","service":"site_subgraph"}`.

- **MongoDB**: `localhost:27017`

- **Redis**: `localhost:6379`



For backend service roles, see [docs/backend-apps.md](docs/backend-apps.md).  

For GraphQL federation details, see [docs/graphql-federation-plan.md](docs/graphql-federation-plan.md).



## Quickstart



1. Create a `.env` from the template:



```bash

cp .env.example .env

```



2. Start everything:



```bash

docker compose up --build

```

The first start can take a few minutes while subgraphs install shared deps and pass healthchecks; the router and frontend start only after `site_subgraph` (and siblings) are listening.

To confirm the site subgraph is up before opening the homepage:

- `http://localhost:5013/health` — should return `{"status":"ok","service":"site_subgraph"}`. A connection error here means the router will fail `homepageFeed` queries until the container finishes starting (or you run `docker compose restart site_subgraph graphql_router`).



3. Open the homepage:



- `http://localhost:3000`



4. Explore GraphQL:



- `http://localhost:4000/graphql` (Apollo Router sandbox when enabled)



## First data to see a feed



The homepage feed is driven by an **active** `homepage` layout plus slots, and **published** articles.



### Seed dev data (recommended)



Run this once after the stack is up:



```bash

docker compose exec admin_app python seed_dev.py

```

The seed script clears the GraphQL homepage feed cache in Redis so the site picks up new articles immediately. If the homepage still looks empty after seeding, run:

```bash

docker compose exec redis redis-cli DEL graphql:homepageFeed

```

Then hard-refresh `http://localhost:3000`.

## Database indexes

MongoDB indexes are created idempotently on REST app startup via `backend/shared/shared/core/indexes.py` (`ensure_indexes`). The dev seed script calls the same helper. In production, indexes are applied automatically when services start; no separate migration step is required unless you add new index definitions — deploy updated services and restart.

Defaults (override via `.env`):



- `SEED_ADMIN_EMAIL=admin@newscore.local`

- `SEED_ADMIN_PASSWORD=admin123!`

- `SEED_ADMIN_FULL_NAME=NewsCore Admin`



### Manual flow (optional)



Suggested manual flow:



- Login via Admin API `POST /auth/login` to get a JWT

- Create categories and articles via News Storage API

- Publish articles

- Create a `homepage` layout and one slot pinned to published articles

- Refresh `/` in the frontend

## Editorial admin UI

A minimal admin route group is available at `http://localhost:3000/admin/login`. Sign in with seed credentials (or any admin/editor account). The dashboard lists articles and supports one-click publish via the News Storage REST API.

REST APIs are versioned at `/api/v1/admin`, `/api/v1/news`, and `/api/v1/layout` through Nginx. Direct port access (`:5001`–`:5003`) remains available for local development.


