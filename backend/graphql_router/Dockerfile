FROM node:20-bookworm-slim AS rover
RUN npm install -g @apollo/rover@0.28.1

FROM ghcr.io/apollographql/router:v1.53.0

USER root
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
COPY --from=rover /usr/local/bin/node /usr/local/bin/node
COPY --from=rover /usr/local/lib/node_modules /usr/local/lib/node_modules
# Do not copy /usr/local/bin/rover — that shim requires ./binary beside it.
# entrypoint.sh invokes @apollo/rover/run.js instead.
COPY router.yaml /config/router.yaml
COPY supergraph.yaml /config/supergraph.yaml
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 4000 8088

ENTRYPOINT ["/entrypoint.sh"]
