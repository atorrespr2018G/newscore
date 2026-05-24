"""Site federated subgraph entrypoint."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from shared.core.cache_listener import start_cache_listener
from shared.core.db import close_db, open_db
from site_subgraph.context import get_context
from site_subgraph.schema import schema


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Open MongoDB and start cache invalidation listener."""

    open_db()
    listener_task = start_cache_listener()
    try:
        yield
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        close_db()


app = FastAPI(title="NewsCore Site Subgraph", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_app = GraphQLRouter(schema, context_getter=get_context, path="/graphql")
app.include_router(graphql_app)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check for compose and router startup."""

    return {"status": "ok", "service": "site_subgraph"}
