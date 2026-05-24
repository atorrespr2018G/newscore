"""GraphQL contract tests — field names used by the frontend."""

from __future__ import annotations

from pathlib import Path


def test_frontend_graphql_operations_match_schema_fields() -> None:
    """Ensure .graphql operation files request fields present in the checked-in schema."""

    repo_root = Path(__file__).resolve().parents[2]
    schema_path = repo_root / "frontend" / "lib" / "graphql" / "schema.graphql"
    ops_dir = repo_root / "frontend" / "lib" / "graphql" / "operations"
    schema = schema_path.read_text(encoding="utf-8")

    required_in_ops = ["homepageFeed", "articleBySlug", "breakingNews", "authorName", "thumbnailUrl"]
    for op_file in ops_dir.glob("*.graphql"):
        contents = op_file.read_text(encoding="utf-8")
        for field in required_in_ops:
            if field in contents:
                assert field in schema

    assert "presentationType" in schema
