"""Deprecated Delivery REST API — public reads moved to GraphQL."""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(
    title="NewsCore Delivery API (deprecated)",
    version="2.0.0",
    description="REST delivery is retired. Use the GraphQL router at /graphql on port 4000.",
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health endpoint for legacy compose references."""

    return {"status": "deprecated", "graphql": "http://localhost:4000/graphql"}
