# Security policy

## Supported versions

Security fixes go into the latest release only. Before 1.0 that is the latest minor version (`0.x`); upgrade to it to
get fixes. The hosted app at <https://archipen.dev/app/> always runs the latest `main`.

## Reporting a vulnerability

Please report security problems privately through
[GitHub security advisories](https://github.com/archipen-dev/archipen/security/advisories/new), not in a public issue
or pull request. Include what is affected, the steps to reproduce it and the impact you expect.

What happens next:

- We acknowledge the report within 7 days.
- We confirm the problem and share a fix or a plan within 30 days.
- We publish an advisory once a fixed release is out, or after 90 days, whichever comes first. We agree on the timing
  with you before that.
- We credit you in the advisory, unless you prefer not to be named.

## Scope

In scope:

- The web app, both hosted at archipen.dev and in the `ghcr.io/archipen-dev/archipen` image. Opening an untrusted
  `*.archipen.json` file, including its custom icons, must never run code or reach other sites.
- `@archipen/render` and the export server (`ghcr.io/archipen-dev/archipen-render`).
- `@archipen/mcp`, including the local bridge between the MCP server and the browser tab (pairing token, origin check).
- The Docker images and the release pipeline (`.github/workflows/`).

Out of scope:

- The configuration of your own deployment, such as a reverse proxy or an ingress in front of the images.
- Vulnerabilities in dependencies that have no impact on Archipen. Report those upstream.
