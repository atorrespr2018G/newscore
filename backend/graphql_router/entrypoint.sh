#!/bin/sh
set -e

wait_for() {
  url="$1"
  name="$2"
  until wget -q -O - "$url" >/dev/null 2>&1; do
    echo "Waiting for $name at $url..."
    sleep 2
  done
  echo "$name is ready"
}

wait_for "http://content-subgraph:5011/health" "content-subgraph"
wait_for "http://layout-subgraph:5012/health" "layout-subgraph"
wait_for "http://site-subgraph:5013/health" "site-subgraph"

echo "Composing supergraph..."
node /usr/local/lib/node_modules/@apollo/rover/run.js supergraph compose \
  --config /config/supergraph.yaml \
  --elv2-license accept \
  > /dist/supergraph.graphql

CONFIG="${ROUTER_CONFIG:-/config/router.yaml}"
echo "Starting Apollo Router with config ${CONFIG}..."
exec /dist/router --config "${CONFIG}" --supergraph /dist/supergraph.graphql
