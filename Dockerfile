# Archipen: build the static app, then serve it with Caddy.
#   docker build -t archipen .
#   docker run -p 8080:8080 archipen
#   docker run -p 9000:9000 -e PORT=9000 -e BASE_PATH=/tools/archipen archipen
# PORT and BASE_PATH are read at container start; the image itself works under any path.
# Runs as UID 65532 with no capabilities and a read-only root filesystem (Kubernetes "restricted").

# The app is static files: build them once on the build machine's platform, whatever the target architecture.
FROM --platform=$BUILDPLATFORM node:24.22.2-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY docs/package.json docs/
COPY mcp/package.json mcp/
RUN npm ci --workspace app --include-workspace-root
COPY app app
COPY scripts/vite-notices.mjs scripts/vite-notices.d.mts scripts/
COPY examples examples
RUN npm run build --workspace app

FROM caddy:2.11.7-alpine
LABEL org.opencontainers.image.source="https://github.com/archipen-dev/archipen" \
      org.opencontainers.image.licenses="MIT"
# The base image gives caddy a file capability for ports <1024. Under "drop ALL" that makes exec fail, and port 8080
# doesn't need it.
RUN setcap -r /usr/bin/caddy
# Nothing here uses curl (the smoke test runs it on the host); removing it also drops libcurl and brotli.
RUN apk del --no-cache curl
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/app/dist /srv
ENV PORT=8080 BASE_PATH="" XDG_DATA_HOME=/tmp/caddy/data XDG_CONFIG_HOME=/tmp/caddy/config
EXPOSE 8080
# Numeric, so Kubernetes can verify runAsNonRoot. All files stay root-owned and read-only to it.
USER 65532:65532
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
