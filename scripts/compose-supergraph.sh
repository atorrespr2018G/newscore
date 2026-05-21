#!/bin/sh
# Compose the federated supergraph from running subgraphs (requires Rover CLI).
set -e
rover supergraph compose \
  --config backend/graphql_router/supergraph.yaml \
  --elv2-license accept \
  > backend/graphql_router/supergraph.graphql
echo "Wrote backend/graphql_router/supergraph.graphql"
