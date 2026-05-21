"""Site federated subgraph entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from shared.core.db import close_db, open_db
from site_subgraph.context import get_context
from site_subgraph.schema import schema


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Open and close MongoDB for the app lifetime."""

    open_db()
    try:
        yield
    finally:
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
