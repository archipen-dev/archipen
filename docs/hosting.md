# Hosting

Archipen is a static web app: one `index.html` plus assets. There is no backend and no database. (An optional
[export server](#export-server) renders diagrams for other programs; the app doesn't need it.) Diagrams stay in
each visitor's browser (IndexedDB) and in the files they save, and share links carry the diagram in the URL fragment,
which browsers never send to the server.

**One build runs under any URL path.** The app uses relative asset URLs and hash routes (`…/#/d/<id>`,
`…/#/share#…`), so the server only ever has to serve files from one folder:

- no base path to set when you build
- no rewrite rules or SPA fallback on the server

Put the same build at `/`, at `/tools/archipen/`, or anywhere else.

::: tip Browser storage is per origin
Autosaved diagrams are stored per origin (scheme, host and port), not per path. Two copies of Archipen on the same
host share one diagram list.
:::

## From source

You need Node.js 22 or newer.

```sh
git clone <this repository> archipen
cd archipen
npm ci
npm run build          # type-checks, then writes the app to app/dist/
```

`app/dist/` is the whole app. Copy it to any static file server, under any path:

```sh
# quick local check
npm run preview                                   # http://localhost:4173

# Caddy
caddy file-server --root app/dist --listen :8080

# Python, from a folder that contains the build as tools/archipen/
python3 -m http.server 8080                       # http://localhost:8080/tools/archipen/
```

With nginx, a plain `location` is enough. Note the trailing slash: visitors must land on the folder (`…/archipen/`) so
relative URLs resolve inside it.

```nginx
location = /tools/archipen { return 308 /tools/archipen/; }
location /tools/archipen/ {
    alias /var/www/archipen/;            # the contents of app/dist
    add_header Cache-Control "no-cache";
    include /etc/nginx/snippets/archipen-headers.conf;
}
location /tools/archipen/assets/ {
    alias /var/www/archipen/assets/;
    add_header Cache-Control "public, max-age=31536000, immutable";
    include /etc/nginx/snippets/archipen-headers.conf;
}
```

`/etc/nginx/snippets/archipen-headers.conf` holds the same headers as the Docker image (`app/csp.ts`,
`deploy/Caddyfile`). nginx drops the outer `add_header` lines in any block that sets its own, so both locations
include it:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:*; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
add_header X-Frame-Options DENY always;
add_header Cross-Origin-Opener-Policy same-origin always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
```

Files in `assets/` have a content hash in their name and can be cached forever. `index.html`, `sw.js` and
`manifest.webmanifest` should not be cached for long, so visitors pick up new versions.

### Offline and install

The build includes a service worker that stores the whole app (about 3 MB) in the browser on the first visit. After
that, Archipen opens and edits diagrams without a network connection, and browsers offer to install it as an app.
When you deploy a new version, open tabs show a "new version available" message with a Reload button; nothing
reloads on its own.

Service workers only run over HTTPS, or on `localhost`. Served over plain HTTP from another host, the app still works,
just not offline.

### Development

```sh
npm run dev            # editor with hot reload, http://localhost:5173
npm test               # unit tests (vitest)
npm run e2e            # browser tests (Playwright)
npm run docs:dev       # this documentation site
```

## Docker

The repository has a `Dockerfile` that builds the app and serves it with [Caddy](https://caddyserver.com). The container
reads two settings **when it starts**, so one image can run on any port and path:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port Caddy listens on inside the container. |
| `BASE_PATH` | *(empty: site root)* | URL path to serve under, e.g. `/tools/archipen`. Leading slash, no trailing slash. |

Ready-made images for `linux/amd64` and `linux/arm64` are published to GitHub Container Registry as
`ghcr.io/archipen-dev/archipen`, and the export server as `ghcr.io/archipen-dev/archipen-render`:

| Tag | Built from |
|---|---|
| `latest`, `1.2.3`, `1.2` | release tags (`v1.2.3`) |
| `edge` | the latest commit on `main` |
| `sha-<commit>` | that commit |

Or build the image yourself:

```sh
docker build -t archipen .

# at the root, on port 8080
docker run --rm -p 8080:8080 archipen

# under a path, on another port
docker run --rm -p 9000:9000 -e PORT=9000 -e BASE_PATH=/tools/archipen archipen
# → http://localhost:9000/tools/archipen/
```

What the image does:

- Serves the app under `BASE_PATH/`. A request to `BASE_PATH` without the slash is redirected to it, and everything
  else returns 404.
- Sends `immutable` cache headers for hashed assets, `no-cache` for `index.html`, `sw.js` and the manifest, and gzip/zstd compression.
- Runs as UID 65532 with no Linux capabilities and nothing written to disk, so it works with a read-only root
  filesystem (see [Kubernetes](#kubernetes)). Caddy's admin API is off.
- Speaks plain HTTP; terminate TLS in front of it.
- Sends a strict `Content-Security-Policy` (only the app's own scripts, nothing loaded from other sites) and forbids
  showing the app inside a frame (`frame-ancestors 'none'`, `X-Frame-Options: DENY`). The policy is in `app/csp.ts`.
  The built `index.html` carries the same policy in a `<meta>` tag, so hosts that can't set headers, like GitHub
  Pages, still get it, except for the framing rule, which only works as a header.

The Caddy config is `deploy/Caddyfile` in the repository. To change it without rebuilding,
mount your own: `-v ./Caddyfile:/etc/caddy/Caddyfile:ro`.

### Behind a reverse proxy

Forward the path unchanged and set the same `BASE_PATH` in the container. For example, with Docker Compose and Caddy
in front:

```yaml
services:
  archipen:
    image: archipen
    environment:
      BASE_PATH: /tools/archipen
```

```text
example.com {
	reverse_proxy /tools/archipen* archipen:8080
}
```

## Export server

The app makes exports in the browser and needs no backend. If other programs need to render diagrams, for example a
wiki plugin, a CI job or a chat bot, you can run the optional **export server**: you POST a diagram and get SVG, PNG or
PDF back. The routes and parameters are in [Export without a browser](./export#http-api).

It's a small Node.js process, separate from the static app. **GitHub Pages can't host it**: Pages only serves static
files, so the site published by `pages.yml` includes the app but not the API. Run the server on your own machine,
container platform or VM.

It reads the same settings as the app container **when it starts**, and serves everything under `BASE_PATH`:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port to listen on. |
| `BASE_PATH` | *(empty: site root)* | URL path to serve under, e.g. `/tools/archipen-api`. Leading slash, no trailing slash. A request to `BASE_PATH` without the slash is redirected to it; everything outside it returns 404. |
| `CORS_ORIGIN` | *(none)* | Set to an origin (or `*`) to let web pages on that origin call the API from the browser. |
| `RENDER_WORKERS` | number of CPUs | Threads that render. Requests are parsed on the main thread, so `/healthz` stays responsive while renders run. |
| `RENDER_QUEUE` | 8 per thread | Renders that may wait for a free thread. Beyond that the server answers `503` with `Retry-After`. |
| `RENDER_TIMEOUT_MS` | `20000` | Time limit for one render. A slower one is stopped and answered with `422`. |
| `MAX_ITEMS` | `1000` | Most nodes, zones, wires and texts in one diagram, all pages together. Larger diagrams are answered with `422`. |

The server has **no authentication and no rate limiting**. Anyone who can reach it can make it work, so keep it on an
internal network or put it behind a proxy that authenticates callers and limits request rates. The limits above
keep one request from taking the server down, not many.

### From source

```sh
# from this repository
npm ci
npm run build -w render
PORT=8787 BASE_PATH=/tools/archipen-api node render/dist/server.mjs
# → http://localhost:8787/tools/archipen-api/
# or, with flags: node render/dist/cli.mjs serve --port 8787 --base-path /tools/archipen-api
```

`--port` and `--base-path` override `PORT` and `BASE_PATH`. Check it with:

```sh
curl http://localhost:8787/tools/archipen-api/healthz
curl -X POST --data-binary @examples/web-shop.archipen.json \
  'http://localhost:8787/tools/archipen-api/export?format=png' -o web-shop.png
```

To keep it running, use your usual process manager. For example, install it globally
(`npm install -g @archipen/render`) and use a minimal systemd unit:

```ini
[Service]
ExecStart=/usr/bin/env archipen serve
Environment=PORT=8787 BASE_PATH=/tools/archipen-api
DynamicUser=yes
Restart=on-failure
```

### Docker

The export server has its own image, built from `render/Dockerfile` with the repository root as context:

```sh
docker build -f render/Dockerfile -t archipen-render .

# at the root, on port 8080
docker run --rm -p 8080:8080 archipen-render

# under a path, on another port
docker run --rm -p 9000:9000 -e PORT=9000 -e BASE_PATH=/tools/archipen-api archipen-render
# → http://localhost:9000/tools/archipen-api/healthz
```

What the image does:

- Runs `archipen serve` as UID 65532, with a `HEALTHCHECK` on `BASE_PATH/healthz`. Like the app image, it needs no
  capabilities and writes nothing to disk (see [Kubernetes](#kubernetes)).
- Accepts bodies up to 5 MB, PNG scale up to 8, and drops clients that take longer than 30 s to send a request.
- Speaks plain HTTP; terminate TLS in front of it. It stops cleanly on `docker stop`.

### Next to the app, behind a reverse proxy

Forward each path unchanged and set the same `BASE_PATH` in each container:

```yaml
services:
  archipen:
    image: archipen
    environment:
      BASE_PATH: /tools/archipen
  archipen-render:
    image: archipen-render
    environment:
      BASE_PATH: /tools/archipen-api
```

```text
example.com {
	reverse_proxy /tools/archipen-api* archipen-render:8080
	reverse_proxy /tools/archipen* archipen:8080
}
```

`/tools/archipen*` also matches `/tools/archipen-api…`; Caddy tries the longer path first, so API requests reach the
export server.

With nginx:

```nginx
location /tools/archipen-api/ {
    proxy_pass http://127.0.0.1:8787;    # no trailing slash: the path is forwarded unchanged
    client_max_body_size 5m;
}
```

The server has no authentication. If it shouldn't be public, restrict it at the proxy (IP allowlist, basic auth or
your SSO) or keep it on an internal network.

## Kubernetes

Both images run under the [restricted](https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted)
Pod Security Standard with a read-only root filesystem. They:

- run as a numeric non-root user (UID/GID 65532), so `runAsNonRoot` can be checked without setting `runAsUser`
- need no Linux capabilities and listen on 8080
- write nothing to disk, so no volume is needed (mounting an `emptyDir` on `/tmp` does no harm)

CI runs each image this way before publishing it (`scripts/docker-smoke.sh`). A Deployment for the app:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: archipen
spec:
  selector:
    matchLabels: { app: archipen }
  template:
    metadata:
      labels: { app: archipen }
    spec:
      securityContext:
        runAsNonRoot: true
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: archipen
          image: ghcr.io/archipen-dev/archipen:latest
          env:
            - { name: BASE_PATH, value: /tools/archipen }
          ports:
            - containerPort: 8080
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: [ALL] }
          readinessProbe:
            httpGet: { path: /tools/archipen/, port: 8080 }
          livenessProbe:
            httpGet: { path: /tools/archipen/, port: 8080 }
```

The export server's Deployment has the same shape. Use `ghcr.io/archipen-dev/archipen-render`, its own `BASE_PATH`, and
probes on `BASE_PATH/healthz`, for example `/tools/archipen-api/healthz`.

## GitHub Pages

The repository can publish this documentation site with a live copy of the app under `app/`. See
`.github/workflows/pages.yml`.

The official site is <https://archipen.dev/>, served by GitHub Pages under a custom domain.

1. In the repository settings, under **Pages**, set the source to **GitHub Actions**.
2. Under **Pages → Custom domain**, enter the domain and turn on **Enforce HTTPS**. Point the domain's DNS at GitHub
   Pages: `A`/`AAAA` records for the apex, or a `CNAME` to `<owner>.github.io` for a subdomain. Verify the domain in
   the organization's Pages settings so no other repository can claim it. A `CNAME` file is not needed: Actions
   deployments use the domain from the settings.
3. Push to `main`. The workflow runs the tests and `npm run site:build`, then deploys `docs/.vitepress/dist`.

The site lives at the root of its domain, which is set by `DOCS_BASE: /` in the workflow. A fork without a custom
domain is served at `https://<owner>.github.io/<repository>/`; set `DOCS_BASE` to `/<repository>/` there. To build it
locally:

```sh
npm run site:build                                # docs + app + schema + examples
npx vitepress preview docs                        # http://localhost:4173/
```

Only the docs pages need `DOCS_BASE`. The app copied into `app/` is the same build as everywhere else. If you host the
app somewhere else and use the MCP server, set `ARCHIPEN_APP_URL` (see [MCP](mcp.md)).
