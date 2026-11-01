# Archipen export server: POST a diagram, get SVG/PNG/PDF back. Separate from the static app image.
#   docker build -f render/Dockerfile -t archipen-render .
#   docker run -p 8080:8080 archipen-render
#   docker run -p 9000:9000 -e PORT=9000 -e BASE_PATH=/tools/archipen-api archipen-render
# PORT, BASE_PATH and CORS_ORIGIN are read at container start.
# Runs as UID 65532 with no capabilities and a read-only root filesystem (Kubernetes "restricted"), like the app image.

# The build output (dist/ and fonts/) is plain JavaScript, so it is built once on the build machine's platform.
FROM --platform=$BUILDPLATFORM node:24.22.2-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY render/package.json render/
COPY docs/package.json docs/
COPY mcp/package.json mcp/
RUN npm ci --workspace render --workspace app --include-workspace-root
COPY app app
COPY scripts/vite-notices.mjs scripts/vite-notices.d.mts scripts/
COPY render render
RUN npm run build --workspace render

# Runtime: production dependencies only (resvg ships a prebuilt musl binary per architecture), then npm itself is removed.
FROM node:24.22.2-alpine
WORKDIR /srv
LABEL org.opencontainers.image.source="https://github.com/archipen-dev/archipen" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production PORT=8080 BASE_PATH=""
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY render/package.json render/
COPY docs/package.json docs/
COPY mcp/package.json mcp/
RUN npm ci --omit=dev --workspace render --ignore-scripts \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn*
COPY --from=build /repo/render/dist render/dist
COPY --from=build /repo/render/fonts render/fonts
COPY --from=build /repo/render/vendor-icon-credits.txt /repo/render/LICENSE render/
# Numeric, so Kubernetes can verify runAsNonRoot. All files stay root-owned and read-only to it; nothing is written at runtime.
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}${process.env.BASE_PATH}/healthz`).then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "render/dist/cli.mjs", "serve"]
