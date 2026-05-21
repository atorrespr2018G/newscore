# NewsCore (Newscore)



Full-stack news platform:



- **Frontend**: Next.js 14 on `http://localhost:3000`

- **GraphQL (public reads)**: Apollo Router on `http://localhost:4000/graphql` (also `http://localhost/graphql` via Nginx)

- **Gateway**: Nginx on `http://localhost` (routes `/api/*` to REST services)

- **Admin API**: FastAPI `http://localhost:5001/docs`

- **News Storage API**: FastAPI `http://localhost:5002/docs`

- **Layout Admin API**: FastAPI `http://localhost:5003/docs`

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


